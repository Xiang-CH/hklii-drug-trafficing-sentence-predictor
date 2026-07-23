from langgraph_sdk import Auth
from jwt import PyJWKClient
import asyncio
import jwt
import os

from src.identity import user_scope


AUTH0_DOMAIN = os.environ["AUTH0_DOMAIN"]
AUTH0_AUDIENCE = os.environ["AUTH0_AUDIENCE"]
AUTH0_ISSUER = f"https://{AUTH0_DOMAIN}/"

auth = Auth()

jwks_client = PyJWKClient(f"{AUTH0_ISSUER}.well-known/jwks.json")

def verify_token_sync(token: str) -> dict:
    signing_key = jwks_client.get_signing_key_from_jwt(token)

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=AUTH0_AUDIENCE,
        issuer=AUTH0_ISSUER,
    )

@auth.authenticate
async def authenticate(headers: dict) -> Auth.types.MinimalUserDict:
    raw = headers.get(b"authorization")

    if not raw:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Missing Authorization header",
        )

    value = raw.decode()
    if not value.startswith("Bearer "):
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid Authorization header",
        )

    token = value.removeprefix("Bearer ").strip()

    try:
        claims = await asyncio.to_thread(verify_token_sync, token)
    except Exception as e:
        print("VERIFY ERROR:", type(e).__name__, repr(e))
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid access token",
        )

    return {
        "identity": claims["sub"],
        "is_authenticated": True,
        "email": claims.get("email"),
        "permissions": claims.get("permissions", []),
    }

@auth.on.threads
async def authorize_threads(
    ctx: Auth.types.AuthContext,
    value: dict,
):
    """
    Restrict every thread and its runs to the authenticated Auth0 user.
    """
    user_id = ctx.user.identity

    # On thread/run creation, this is persisted with the resource.
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = user_id

    # On every operation, LangGraph applies this as an access filter.
    return {"owner": user_id}

@auth.on.store
async def authorize_store(
    ctx: Auth.types.AuthContext,
    value: Auth.types.on.store.value,
):
    """Isolate every long-term store namespace to the authenticated user."""
    namespace = tuple(value["namespace"]) if value.get("namespace") else ()

    # Application code puts this fixed-length, wildcard-free scope first in
    # every namespace. Reject mismatches instead of adding a second prefix.
    expected_scope = user_scope(ctx.user.identity)
    if not namespace or namespace[0] != expected_scope:
        raise Auth.exceptions.HTTPException(
            status_code=403,
            detail="Not authorized to access this store namespace.",
        )