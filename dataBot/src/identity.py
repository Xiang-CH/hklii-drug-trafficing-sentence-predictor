import hashlib


def user_scope(identity: str) -> str:
    """Return a fixed-length, wildcard-free namespace component for a user."""
    return "u-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()