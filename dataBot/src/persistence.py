import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import (
    AsyncPostgresSaver,
    AsyncShallowPostgresSaver,
)
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore
from langgraph.store.postgres.aio import AsyncPostgresStore

_POSTGRES_ENV_NAMES = (
    "LANGGRAPH_POSTGRES_URI",
    "POSTGRES_URI_CUSTOM",
    "POSTGRES_URI",
    "DATABASE_URL",
)


def get_postgres_uri(*, required: bool = True) -> str | None:
    """Return the configured PostgreSQL URI without logging credentials."""
    for name in _POSTGRES_ENV_NAMES:
        value = os.getenv(name)
        if value:
            return value

    if required:
        names = ", ".join(_POSTGRES_ENV_NAMES)
        raise RuntimeError(
            "PostgreSQL persistence is enabled but no connection URI is set. "
            f"Configure one of: {names}."
        )
    return None


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _use_shallow_checkpoints() -> bool:
    return _env_bool("LANGGRAPH_SHALLOW_CHECKPOINTS", False)


def _auto_setup() -> bool:
    return _env_bool("LANGGRAPH_POSTGRES_AUTO_SETUP", True)


@asynccontextmanager
async def generate_checkpointer() -> AsyncIterator[BaseCheckpointSaver]:
    """Yield the PostgreSQL checkpointer used by LangGraph Agent Server.

    Set ``LANGGRAPH_SHALLOW_CHECKPOINTS=true`` to retain only the latest
    checkpoint per thread. This reduces database growth but disables checkpoint
    history/time-travel semantics.
    """
    uri = get_postgres_uri(required=True)
    saver_cls = (
        AsyncShallowPostgresSaver
        if _use_shallow_checkpoints()
        else AsyncPostgresSaver
    )

    async with saver_cls.from_conn_string(uri) as saver:
        if _auto_setup():
            await saver.setup()
        yield saver


@asynccontextmanager
async def generate_store() -> AsyncIterator[BaseStore]:
    """Yield the PostgreSQL long-term memory store used by Agent Server."""
    uri = get_postgres_uri(required=True)
    async with AsyncPostgresStore.from_conn_string(uri) as store:
        if _auto_setup():
            await store.setup()
        yield store


@asynccontextmanager
async def standalone_persistence(
    *,
    allow_in_memory_fallback: bool = False,
) -> AsyncIterator[tuple[BaseCheckpointSaver, BaseStore]]:
    """Open persistence backends for direct Python invocation.

    Agent Server users do not call this function; the server creates the
    resources from ``langgraph.json``. Pass ``allow_in_memory_fallback=True``
    only for ephemeral local tests; an in-memory fallback cannot continue a
    thread across separate process invocations.
    """
    uri = get_postgres_uri(required=not allow_in_memory_fallback)
    if not uri:
        yield InMemorySaver(), InMemoryStore()
        return

    saver_cls = (
        AsyncShallowPostgresSaver
        if _use_shallow_checkpoints()
        else AsyncPostgresSaver
    )
    async with saver_cls.from_conn_string(uri) as saver:
        async with AsyncPostgresStore.from_conn_string(uri) as store:
            if _auto_setup():
                await saver.setup()
                await store.setup()
            yield saver, store
