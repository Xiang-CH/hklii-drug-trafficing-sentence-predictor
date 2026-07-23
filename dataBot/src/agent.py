import asyncio
import os
import re
import traceback
import uuid
from typing import Annotated, Any, TypedDict

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ClearToolUsesEdit,
    ContextEditingMiddleware,
    SummarizationMiddleware,
)
from langchain.messages import (
    AIMessage,
    AIMessageChunk,
    RemoveMessage,
    ToolMessage,
)
from langchain_openai import ChatOpenAI
from langchain_mongodb.agent_toolkit import (
    MongoDBDatabase,
    MongoDBDatabaseToolkit,
)
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.errors import GraphBubbleUp
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import REMOVE_ALL_MESSAGES, add_messages
from langgraph.graph.ui import AnyUIMessage, push_ui_message, ui_message_reducer
from langgraph.store.base import BaseStore

from src.memory_tools import recall_user_memories, remember_user_memory
from src.persistence import standalone_persistence
from src.prompt import MONGODB_AGENT_SYSTEM_PROMPT

load_dotenv()

MONGODB_URI = os.getenv("DB_MONGODB_URI")
DB_NAME = os.getenv("DB_NAME")
FEATURES_TABLE_NAME = "verified-features"
TEXT_TABLE_NAME = "judgement-html"

BASE_URL = os.getenv("OPENAI_BASE_URL")
API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("MODEL")

NATURAL_LANGUAGE_QUERY = (
    "Find the number of cases for cocaine trafficking each year in the last 5 years"
)

_TOOL_ERROR_MESSAGE_LIMIT = 4000


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return max(minimum, int(raw))
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}.") from error


SUMMARY_TRIGGER_TOKENS = _env_int("SUMMARY_TRIGGER_TOKENS", 12_000)
SUMMARY_KEEP_MESSAGES = _env_int("SUMMARY_KEEP_MESSAGES", 12)
SUMMARY_INPUT_TOKENS = _env_int("SUMMARY_INPUT_TOKENS", 8_000)
CONTEXT_EDIT_TRIGGER_TOKENS = _env_int("CONTEXT_EDIT_TRIGGER_TOKENS", 8_000)
RECENT_TOOL_RESULTS_TO_KEEP = _env_int("RECENT_TOOL_RESULTS_TO_KEEP", 3)
MAX_TOOL_OUTPUT_CHARS = _env_int("MAX_TOOL_OUTPUT_CHARS", 40_000)


def _coerce_message_content(content: Any) -> str:
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            else:
                parts.append(str(item))
        return "".join(parts)
    if content is None:
        return ""
    return str(content)


def _bounded_tool_result(result: Any) -> Any:
    """Prevent a single database result from poisoning every future prompt."""
    if not isinstance(result, ToolMessage):
        return result

    text = _coerce_message_content(result.content)
    if len(text) <= MAX_TOOL_OUTPUT_CHARS:
        return result

    truncated = (
        text[:MAX_TOOL_OUTPUT_CHARS]
        + "\n\n[Tool output truncated by the application. Refine the query, "
        "aggregate further, or request a smaller result set.]"
    )
    return result.model_copy(update={"content": truncated})


def _build_tool_error_message(request: Any, error: Exception) -> ToolMessage:
    if os.getenv("LOG_TOOL_TRACEBACKS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }:
        traceback.print_exc()

    detail = f"{type(error).__name__}: {error}"
    if len(detail) > _TOOL_ERROR_MESSAGE_LIMIT:
        detail = detail[:_TOOL_ERROR_MESSAGE_LIMIT] + "…"
    body = (
        "Tool invocation failed. Use this error to fix arguments or strategy and retry.\n\n"
        f"{detail}"
    )
    return ToolMessage(
        content=body,
        tool_call_id=request.tool_call["id"],
        status="error",
    )


class BoundedToolMiddleware(AgentMiddleware):
    """Convert tool failures to messages and cap successful tool output size."""

    def wrap_tool_call(self, request: Any, handler: Any) -> Any:
        try:
            return _bounded_tool_result(handler(request))
        except GraphBubbleUp:
            raise
        except Exception as error:
            return _build_tool_error_message(request, error)

    async def awrap_tool_call(self, request: Any, handler: Any) -> Any:
        try:
            return _bounded_tool_result(await handler(request))
        except GraphBubbleUp:
            raise
        except Exception as error:
            return _build_tool_error_message(request, error)


def _normalize_message(message: Any) -> Any:
    if isinstance(message, dict):
        if "role" in message and "content" in message:
            return message
        if message.get("lc") == 1 and "kwargs" in message:
            message_id = message.get("id")
            message_type = (
                message_id[-1]
                if isinstance(message_id, list) and message_id
                else None
            )
            role = {
                "HumanMessage": "user",
                "AIMessage": "assistant",
                "SystemMessage": "system",
                "ToolMessage": "tool",
            }.get(message_type, "user")
            kwargs = message.get("kwargs", {})
            normalized: dict[str, Any] = {
                "role": role,
                "content": _coerce_message_content(kwargs.get("content")),
            }
            if kwargs.get("id"):
                normalized["id"] = kwargs["id"]
            if role == "tool" and kwargs.get("tool_call_id"):
                normalized["tool_call_id"] = kwargs["tool_call_id"]
            return normalized
    return message


def _normalize_input(payload: Any) -> Any:
    if not isinstance(payload, dict) or "messages" not in payload:
        return payload
    messages = payload.get("messages")
    if messages is None:
        return payload

    normalized = []
    for message in messages:
        if isinstance(message, tuple) and len(message) == 2:
            role, content = message
            normalized.append({"role": role, "content": content})
        else:
            normalized.append(_normalize_message(message))
    return {**payload, "messages": normalized}


class TokenUsage(TypedDict):
    input_tokens: int
    output_tokens: int
    total_tokens: int


class AgentState(TypedDict, total=False):
    messages: Annotated[list[Any], add_messages]
    ui: Annotated[list[AnyUIMessage], ui_message_reducer]
    usage: TokenUsage


def _build_llm() -> ChatOpenAI:
    if not MODEL:
        raise RuntimeError("MODEL is required.")
    if not API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required.")

    return ChatOpenAI(
        model=MODEL,
        timeout=60,
        base_url=BASE_URL,
        api_key=API_KEY,
        stream_usage=True,
    )


def _build_toolkit(llm: ChatOpenAI) -> MongoDBDatabaseToolkit:
    if not MONGODB_URI:
        raise RuntimeError("DB_MONGODB_URI is required.")
    if not DB_NAME:
        raise RuntimeError("DB_NAME is required.")

    db_wrapper = MongoDBDatabase.from_connection_string(
        MONGODB_URI,
        database=DB_NAME,
    )
    return MongoDBDatabaseToolkit(db=db_wrapper, llm=llm)


def extract_html_code_block(text: str) -> str | None:
    pattern = r"```(?:html)?\s*([\s\S]*?)```"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def collect_usage(state: AgentState) -> dict[str, TokenUsage]:
    usage: TokenUsage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
    }

    for msg in state.get("messages", []):
        msg_usage = getattr(msg, "usage_metadata", None)
        if not msg_usage:
            continue

        usage["input_tokens"] += msg_usage.get("input_tokens", 0)
        usage["output_tokens"] += msg_usage.get("output_tokens", 0)
        usage["total_tokens"] += msg_usage.get("total_tokens", 0)

    return {"usage": usage}


def build_agent(
    *,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
):
    llm = _build_llm()
    toolkit = _build_toolkit(llm)
    system_message = MONGODB_AGENT_SYSTEM_PROMPT.format(
        table_name_features=FEATURES_TABLE_NAME,
        table_name_text=TEXT_TABLE_NAME,
    )

    agent_core = create_agent(
        llm,
        [
            *toolkit.get_tools(),
            remember_user_memory,
            recall_user_memories,
        ],
        system_prompt=system_message,
        store=store,
        middleware=[
            BoundedToolMiddleware(),
            ContextEditingMiddleware(
                edits=[
                    ClearToolUsesEdit(
                        trigger=CONTEXT_EDIT_TRIGGER_TOKENS,
                        keep=RECENT_TOOL_RESULTS_TO_KEEP,
                        clear_tool_inputs=False,
                        placeholder="[older tool result cleared to control context size]",
                    )
                ]
            ),
            SummarizationMiddleware(
                model=llm,
                trigger=("tokens", SUMMARY_TRIGGER_TOKENS),
                keep=("messages", SUMMARY_KEEP_MESSAGES),
                trim_tokens_to_summarize=SUMMARY_INPUT_TOKENS,
            ),
        ],
    )

    graph = StateGraph(AgentState)

    def normalize_node(state: AgentState) -> dict[str, list[Any]]:
        messages = state.get("messages", [])
        normalized = _normalize_input({"messages": messages}).get("messages", [])
        if normalized == messages:
            return {}

        # Replace only when a client sent LangChain's serialized LC form. Returning
        # the complete history through add_messages without first clearing it would
        # duplicate messages once a checkpointer is enabled.
        return {
            "messages": [
                RemoveMessage(id=REMOVE_ALL_MESSAGES),
                *normalized,
            ]
        }

    def output_separate(state: AgentState) -> dict[str, list[AIMessage]]:
        messages = state.get("messages", [])
        if not messages:
            return {}

        last_message = messages[-1]
        response = getattr(last_message, "content", None)
        if not response:
            return {}

        embedded_html = extract_html_code_block(_coerce_message_content(response))
        if not embedded_html:
            return {}

        return_message = AIMessage(
            id=getattr(last_message, "id", None),
            content="I generated an HTML preview. Click the card to open it.",
        )

        push_ui_message(
            "html_preview",
            props={
                "title": "Data Visualization Artifacts",
                "description": "Online live HTML preview",
                "html": embedded_html,
            },
            message=return_message,
        )

        return {"messages": [return_message]}

    graph.add_node("normalize", normalize_node)
    graph.add_node("agent", agent_core)
    graph.add_node("collect_usage", collect_usage)
    graph.add_node("post_extract", output_separate)
    graph.add_edge(START, "normalize")
    graph.add_edge("normalize", "agent")
    graph.add_edge("agent", "collect_usage")
    graph.add_edge("collect_usage", "post_extract")
    graph.add_edge("post_extract", END)
    return graph.compile(checkpointer=checkpointer, store=store)


# Agent Server injects the checkpointer and store configured in langgraph.json.
agent = build_agent()


def _add_usage(total: dict[str, int], usage: dict[str, int] | None) -> None:
    if not usage:
        return
    total["input_tokens"] += usage.get("input_tokens", 0)
    total["output_tokens"] += usage.get("output_tokens", 0)
    total["total_tokens"] += usage.get("total_tokens", 0)


async def astream_query(
    query: str,
    *,
    thread_id: str | None = None,
    user_id: str = "local-user",
    verbose: bool = True,
):
    """Run the graph directly with PostgreSQL-backed persistence.

    Reuse ``thread_id`` across calls to continue a conversation. Agent Server
    clients should use the Threads API instead of this helper.
    """
    messages: list[Any] = []
    token_usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
    }
    resolved_thread_id = thread_id or str(uuid.uuid4())
    config = {
        "configurable": {
            "thread_id": resolved_thread_id,
            "user_id": user_id,
        }
    }

    async with standalone_persistence() as (checkpointer, store):
        standalone_agent = build_agent(checkpointer=checkpointer, store=store)
        async for chunk in standalone_agent.astream(
            {"messages": [("user", query)]},
            config=config,
            stream_mode=["messages", "updates", "values"],
            version="v2",
        ):
            if not verbose:
                if chunk["type"] == "values" and isinstance(chunk["data"], dict):
                    msgs = chunk["data"].get("messages")
                    if msgs is not None:
                        messages = list(msgs)
                continue

            if chunk["type"] == "messages":
                token, _metadata = chunk["data"]
                _add_usage(token_usage, getattr(token, "usage_metadata", None))

                if isinstance(token, AIMessageChunk) and token.text:
                    print(token.text, end="", flush=True)
            elif chunk["type"] == "updates":
                for source, update in chunk["data"].items():
                    if source == "__interrupt__":
                        print(f"\n[interrupt] {update}")
                        continue
                    update_messages = (
                        update.get("messages") if isinstance(update, dict) else None
                    )
                    if not update_messages:
                        continue
                    msg = update_messages[-1]
                    if isinstance(msg, AIMessage) and msg.tool_calls:
                        print(f"\n[tool calls] {msg.tool_calls}", flush=True)
                    if isinstance(msg, ToolMessage):
                        body = _coerce_message_content(msg.content)
                        preview = body[:2000]
                        suffix = "…" if len(body) > 2000 else ""
                        print(f"\n[tool result] {preview}{suffix}", flush=True)
            elif chunk["type"] == "values" and isinstance(chunk["data"], dict):
                msgs = chunk["data"].get("messages")
                if msgs is not None:
                    messages = list(msgs)

    if verbose:
        print()
        print(f"\n[token usage] {token_usage}")
        print(f"[thread id] {resolved_thread_id}")

    return messages, token_usage, resolved_thread_id


def stream_query(
    query: str,
    *,
    thread_id: str | None = None,
    user_id: str = "local-user",
    verbose: bool = True,
):
    return asyncio.run(
        astream_query(
            query,
            thread_id=thread_id,
            user_id=user_id,
            verbose=verbose,
        )
    )


async def arun_query(
    query: str,
    *,
    thread_id: str | None = None,
    user_id: str = "local-user",
    verbose: bool = True,
):
    messages, token_usage, resolved_thread_id = await astream_query(
        query,
        thread_id=thread_id,
        user_id=user_id,
        verbose=verbose,
    )
    if not messages:
        return None
    return {
        "content": messages[-1].content,
        "usage": token_usage,
        "thread_id": resolved_thread_id,
    }


def run_query(
    query: str,
    *,
    thread_id: str | None = None,
    user_id: str = "local-user",
    verbose: bool = True,
):
    return asyncio.run(
        arun_query(
            query,
            thread_id=thread_id,
            user_id=user_id,
            verbose=verbose,
        )
    )


if __name__ == "__main__":
    results = run_query(NATURAL_LANGUAGE_QUERY)
    print(results)
