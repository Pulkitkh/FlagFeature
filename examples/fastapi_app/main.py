"""Minimal FastAPI app consuming FlagForge.

Run it:

    pip install -e ../../sdk fastapi uvicorn
    uvicorn main:app --reload --port 9000

It assumes the FlagForge API is on http://localhost:8000 with a
`development` environment and a `new-checkout-flow` flag. Override with
FLAGFORGE_URL / FLAGFORGE_ENV.

The whole integration is the three lines under "Wiring". Everything else is
the demo application.
"""

import os

from fastapi import Depends, FastAPI

from flagforge import FlagForgeClient
from flagforge.integrations.fastapi import FlagForgeMiddleware, get_flags

API_URL = os.getenv("FLAGFORGE_URL", "http://localhost:8000")
ENVIRONMENT = os.getenv("FLAGFORGE_ENV", "development")

app = FastAPI(title="Demo storefront")

# --- Wiring -----------------------------------------------------------------
flag_client = FlagForgeClient(api_url=API_URL, environment=ENVIRONMENT, refresh_interval=15)
app.add_middleware(FlagForgeMiddleware, client=flag_client)
# ----------------------------------------------------------------------------


@app.get("/checkout")
def checkout(user_id: str = "anonymous", flags: FlagForgeClient = Depends(get_flags)):
    """The flag check is a dict lookup — no network call in the request path."""
    decision = flags.evaluate("new-checkout-flow", user_id=user_id, default=False)

    return {
        "user_id": user_id,
        "checkout": "express" if decision.value else "classic",
        "flag_value": decision.value,
        "resolved_by": decision.reason,
    }


@app.get("/pricing")
def pricing(user_id: str = "anonymous", flags: FlagForgeClient = Depends(get_flags)):
    """A non-boolean flag: the value itself selects the variant."""
    copy_variant = flags.get_value("checkout-copy", user_id=user_id, default="control")
    limit = flags.get_value("search-result-limit", user_id=user_id, default=20)

    return {"user_id": user_id, "copy_variant": copy_variant, "results_per_page": limit}


@app.get("/flags")
def all_flags(user_id: str = "anonymous", flags: FlagForgeClient = Depends(get_flags)):
    """Every flag resolved for one user — what you'd hand a frontend on page load."""
    return flags.all_values(user_id=user_id)


@app.get("/health")
def health(flags: FlagForgeClient = Depends(get_flags)):
    """Surfacing the cache status makes a stale snapshot visible in monitoring."""
    return {"status": "ok", "flagforge": flags.status()}


@app.on_event("shutdown")
def shutdown():
    flag_client.stop()
