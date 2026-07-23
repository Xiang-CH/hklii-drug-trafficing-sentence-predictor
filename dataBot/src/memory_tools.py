import re
import uuid
from datetime import UTC, datetime

from langchain.tools import ToolRuntime, tool

from src.identity import user_scope

_MAX_MEMORY_CHARS = 4000
_MAX_RECALL_ITEMS = 20


def _runtime_user_id(runtime: ToolRuntime) -> str:
    """Resolve the authenticated identity injected by Agent Server.

    ``user_id`` is retained as a standalone/local fallback.
    """
    server_info = getattr(runtime, "server_info", None)
    server_user = getattr(server_info, "user", None)
    server_identity = getattr(server_user, "identity", None)
    if server_identity:
        return str(server_identity)

    config = getattr(runtime, "config", {}) or {}
    configurable = config.get("configurable", {}) if isinstance(config, dict) else {}
    auth_user = configurable.get("langgraph_auth_user") or {}
    if isinstance(auth_user, dict) and auth_user.get("identity"):
        return str(auth_user["identity"])

    context = getattr(runtime, "context", None)
    context_user_id = (
        context.get("user_id")
        if isinstance(context, dict)
        else getattr(context, "user_id", None)
    )
    return str(
        configurable.get("langgraph_auth_user_id")
        or configurable.get("user_id")
        or context_user_id
        or "local-user"
    )


def _category_slug(category: str) -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", category.strip().lower()).strip("-")
    return (slug or "general")[:64]


def _memory_namespace(owner: str) -> tuple[str, ...]:
    # The scope isolates standalone runs even when Agent Server auth is absent.
    # The same scope is stored in the item and used as an equality filter.
    return (user_scope(owner), "user_memories")


@tool
async def remember_user_memory(
    memory: str,
    runtime: ToolRuntime,
    category: str = "general",
) -> str:
    """Save a stable user preference or fact for use in future conversations.

    Use only when the user explicitly asks you to remember something, or when a
    clearly stated, durable preference is important for future assistance. Do
    not store secrets, transient requests, or database query results.
    """
    if runtime.store is None:
        return "Long-term memory is unavailable for this run."

    text = memory.strip()
    if not text:
        return "Nothing was saved because the memory was empty."
    if len(text) > _MAX_MEMORY_CHARS:
        return f"Memory is too long; keep it under {_MAX_MEMORY_CHARS} characters."

    owner = _runtime_user_id(runtime)
    scope = user_scope(owner)
    await runtime.store.aput(
        _memory_namespace(owner),
        str(uuid.uuid4()),
        {
            "memory": text,
            "category": _category_slug(category),
            "owner_scope": scope,
            "created_at": datetime.now(UTC).isoformat(),
        },
    )
    return "Saved to long-term memory."


@tool
async def recall_user_memories(
    runtime: ToolRuntime,
    category: str | None = None,
    limit: int = 10,
) -> str:
    """Recall durable user memories from previous conversation threads.

    Omit ``category`` to recall across all categories.
    """
    if runtime.store is None:
        return "Long-term memory is unavailable for this run."

    safe_limit = max(1, min(int(limit), _MAX_RECALL_ITEMS))
    owner = _runtime_user_id(runtime)
    value_filter: dict[str, str] = {"owner_scope": user_scope(owner)}
    if category and category.strip().lower() not in {"all", "*"}:
        value_filter["category"] = _category_slug(category)

    items = await runtime.store.asearch(
        _memory_namespace(owner),
        filter=value_filter,
        limit=safe_limit,
    )
    if not items:
        return "No saved memories were found."

    rows: list[tuple[str, str, str]] = []
    for item in items:
        value = item.value if isinstance(item.value, dict) else {}
        text = value.get("memory")
        if text:
            rows.append(
                (
                    str(value.get("created_at", "")),
                    str(value.get("category", "general")),
                    str(text),
                )
            )

    rows.sort(key=lambda row: row[0], reverse=True)
    return (
        "\n".join(f"- [{category_name}] {text}" for _, category_name, text in rows)
        if rows
        else "No saved memories were found."
    )
