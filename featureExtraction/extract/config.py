import os

from dotenv import load_dotenv

load_dotenv()


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {value!r}.") from exc


def _get_int_at_least(name: str, default: int, minimum: int) -> int:
    value = _get_int(name, default)
    return max(value, minimum)


RERUN_ALL = False
MAX_RETRIES = _get_int_at_least("MAX_RETRIES", 5, 1)
MODEL = os.getenv("MODEL", "gpt-5-mini")
EXTRACT_LIMIT = _get_int_at_least("EXTRACT_LIMIT", 0, 0)
EXTRACT_CONCURRENCY = _get_int_at_least("EXTRACT_CONCURRENCY", 1, 1)
MUST_INCLUDE_TRIALS: list[str] = [
    "[2021] HKDC 1500",
    "[2025] HKCFI 4288",
    "[2021] HKCFI 1626",
]
