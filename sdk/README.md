# FlagForge Python middleware

An in-memory caching client for the FlagForge API. It holds the whole
environment's flag configuration in memory, refreshes it on a background
thread, and evaluates flags **locally** — so a flag check inside a request
handler is a dictionary lookup, not an HTTP round trip.

Measured against a local server: **2.6µs per local evaluation vs 4.9ms for
`POST /evaluate`** — roughly 1,800× faster, and it keeps working when the flag
service doesn't.

No runtime dependencies: it uses only the standard library, so installing it
into an application can't cause a version conflict.

## Install

```bash
pip install -e ./sdk          # from this repo
```

## Use

```python
from flagforge import FlagForgeClient

flags = FlagForgeClient(
    api_url="http://localhost:8000",
    environment="production",
    refresh_interval=30,       # seconds between background refreshes
)
flags.start()                  # fetches once, then refreshes in the background

if flags.is_enabled("new-checkout-flow", user_id="alice@example.com"):
    render_express_checkout()

# Non-boolean flags return their value
variant = flags.get_value("checkout-copy", user_id="alice@example.com", default="control")

# Groups the caller already knows about are merged with stored memberships
flags.is_enabled("beta-feature", user_id="alice@example.com", groups=["premium_plan"])

# Everything at once — what you'd hand a frontend on page load
flags.all_values(user_id="alice@example.com")
```

`evaluate()` returns a `Decision` when you want to know *why*:

```python
decision = flags.evaluate("new-checkout-flow", user_id="alice@example.com")
decision.value    # True
decision.reason   # "user_targeting"
```

It also works as a context manager, which stops the background thread for you:

```python
with FlagForgeClient(api_url=..., environment=...) as flags:
    ...
```

## Failure behaviour

This is the part that matters in production:

| Situation | What happens |
|---|---|
| API unreachable during a refresh | Keeps serving the last snapshot; logs a warning |
| API unreachable at startup | `start()` does not raise; serves the defaults you pass in |
| Flag key not in the snapshot | Returns your `default`, with reason `flag_not_found` |
| Application shutting down | `stop()` joins the refresh thread |

A flag service being down must never take the application down with it, so no
method on the client raises during evaluation.

Check the cache from your own health endpoint:

```python
flags.status()
# {'environment': 'production', 'flags_cached': 12, 'seconds_since_refresh': 4.1,
#  'last_error': None, 'ready': True}
```

Surfacing `seconds_since_refresh` in monitoring is worth it — it's how you
notice a snapshot has gone stale.

## Framework integrations

### FastAPI

```python
from flagforge import FlagForgeClient
from flagforge.integrations.fastapi import FlagForgeMiddleware, get_flags

client = FlagForgeClient(api_url="http://localhost:8000", environment="production")
app.add_middleware(FlagForgeMiddleware, client=client)

@app.get("/checkout")
def checkout(user_id: str, flags: FlagForgeClient = Depends(get_flags)):
    if flags.is_enabled("new-checkout-flow", user_id=user_id):
        ...
```

### Django

```python
# settings.py
FLAGFORGE = {
    "API_URL": "http://localhost:8000",
    "ENVIRONMENT": "production",
    "REFRESH_INTERVAL": 30,
}
MIDDLEWARE = [..., "flagforge.integrations.django.FlagForgeMiddleware"]
```

```python
# views.py
def checkout(request):
    if request.flags.is_enabled("new-checkout-flow", user_id=request.user.email):
        ...
```

One client is shared process-wide, so every worker thread reads the same cache
and only one background thread refreshes it.

Runnable versions of both are in [`../examples`](../examples).

## How local evaluation stays correct

The client fetches `GET /snapshot/{environment}` — every flag, its targeting
rules, and the group membership map — and applies the same priority order as
the server:

> user targeting → group targeting → percentage rollout → environment override → default value

Percentage rollout uses the identical SHA-256 hash of `user_id:flag_key`, so a
user lands in the same bucket whether they're evaluated locally or by the API.

Two implementations of one ruleset will drift unless something checks, so
`backend/tests/test_middleware.py::test_local_evaluation_matches_the_server`
runs a matrix of flags × user contexts through **both** paths and asserts the
value *and* the reason match. If you change the server's rules, that test fails
until the client agrees.

## Trade-off to be aware of

Flag changes take effect after the next refresh — up to `refresh_interval`
seconds. That's the cost of not making a network call per check. For a kill
switch that must act instantly, call `POST /evaluate` directly instead, or drop
`refresh_interval` to a second or two.
