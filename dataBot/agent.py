from src.agent import (
    NATURAL_LANGUAGE_QUERY,
    agent,
    arun_query,
    astream_query,
    run_query,
    stream_query,
)

__all__ = [
    "NATURAL_LANGUAGE_QUERY",
    "agent",
    "arun_query",
    "astream_query",
    "run_query",
    "stream_query",
]


if __name__ == "__main__":
    results = run_query(NATURAL_LANGUAGE_QUERY)
    print(results)
