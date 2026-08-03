"""Django integration.

In settings.py:

    FLAGFORGE = {
        "API_URL": "http://localhost:8000",
        "ENVIRONMENT": "production",
        "REFRESH_INTERVAL": 30,
    }
    MIDDLEWARE = [
        ...,
        "flagforge.integrations.django.FlagForgeMiddleware",
    ]

In a view:

    def checkout(request):
        if request.flags.is_enabled("new-checkout-flow", user_id=request.user.email):
            ...

One client is shared by the whole process, so every worker thread reads the
same in-memory cache and only one background thread does the refreshing.
"""

import threading

from flagforge.client import FlagForgeClient

_client: FlagForgeClient | None = None
_client_lock = threading.Lock()


def get_client() -> FlagForgeClient:
    """The process-wide client, built from Django settings on first use."""
    global _client

    if _client is not None:
        return _client

    with _client_lock:
        if _client is None:
            from django.conf import settings

            config = getattr(settings, "FLAGFORGE", {}) or {}
            _client = FlagForgeClient(
                api_url=config.get("API_URL", "http://localhost:8000"),
                environment=config.get("ENVIRONMENT", "development"),
                refresh_interval=config.get("REFRESH_INTERVAL", 30),
                timeout=config.get("TIMEOUT", 5),
            )
            _client.start(block_until_ready=config.get("BLOCK_UNTIL_READY", False))

    return _client


def reset_client() -> None:
    """Drop the shared client. Only needed between tests."""
    global _client
    with _client_lock:
        if _client is not None:
            _client.stop()
        _client = None


class FlagForgeMiddleware:
    """Attaches the shared client to every request as `request.flags`."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.client = get_client()

    def __call__(self, request):
        request.flags = self.client
        return self.get_response(request)
