"""FastAPI integration.

    from flagforge import FlagForgeClient
    from flagforge.integrations.fastapi import FlagForgeMiddleware, get_flags

    client = FlagForgeClient(api_url="http://localhost:8000", environment="production")
    app.add_middleware(FlagForgeMiddleware, client=client)

    @app.get("/checkout")
    def checkout(flags = Depends(get_flags)):
        if flags.is_enabled("new-checkout-flow", user_id="alice@example.com"):
            ...

The middleware owns the client's lifecycle: it starts the background refresh on
the first request and attaches the client to `request.state.flags`, so handlers
never touch the network.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from flagforge.client import FlagForgeClient


class FlagForgeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, client: FlagForgeClient, start: bool = True):
        super().__init__(app)
        self.client = client
        if start:
            # block_until_ready=False: never let a slow flag service delay
            # application startup. Until the first snapshot lands, callers get
            # the defaults they passed in.
            self.client.start(block_until_ready=False)

    async def dispatch(self, request: Request, call_next):
        request.state.flags = self.client
        return await call_next(request)


def get_flags(request: Request) -> FlagForgeClient:
    """FastAPI dependency yielding the client attached by the middleware."""
    client = getattr(request.state, "flags", None)
    if client is None:
        raise RuntimeError(
            "FlagForgeMiddleware is not installed — add it with app.add_middleware(...)"
        )
    return client
