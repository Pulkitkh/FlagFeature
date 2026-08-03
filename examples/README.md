# Integration examples

Two small applications showing how a real service consumes FlagForge through
the [Python middleware](../sdk). Both are complete and runnable — the point is
how little code the integration takes.

Both assume the FlagForge API is running on `http://localhost:8000` with a
`development` environment and the flags from the quickstart. Override with
`FLAGFORGE_URL` and `FLAGFORGE_ENV`.

```bash
pip install -e ../sdk
```

## FastAPI

```bash
cd fastapi_app
pip install fastapi uvicorn
uvicorn main:app --reload --port 9000
```

```bash
curl "localhost:9000/checkout?user_id=carol@example.com"
# {"user_id":"carol@example.com","checkout":"express","flag_value":true,"resolved_by":"group_targeting"}

curl "localhost:9000/checkout?user_id=nobody@example.com"
# {"user_id":"nobody@example.com","checkout":"express","flag_value":true,"resolved_by":"percentage_rollout"}

curl localhost:9000/health
# includes the flag cache status: flags_cached, seconds_since_refresh, last_error
```

The entire integration:

```python
flag_client = FlagForgeClient(api_url=API_URL, environment=ENVIRONMENT, refresh_interval=15)
app.add_middleware(FlagForgeMiddleware, client=flag_client)

@app.get("/checkout")
def checkout(user_id: str, flags: FlagForgeClient = Depends(get_flags)):
    if flags.is_enabled("new-checkout-flow", user_id=user_id):
        ...
```

## Django

```bash
cd django_app
pip install django
python app.py runserver 9001
```

```bash
curl "http://localhost:9001/checkout?user_id=carol@example.com"
# {"user_id": "carol@example.com", "checkout": "express", "flag_value": true, "resolved_by": "group_targeting"}
```

The entire integration:

```python
FLAGFORGE = {"API_URL": ..., "ENVIRONMENT": ..., "REFRESH_INTERVAL": 15}
MIDDLEWARE = [..., "flagforge.integrations.django.FlagForgeMiddleware"]

def checkout(request):
    if request.flags.is_enabled("new-checkout-flow", user_id=...):
        ...
```

Everything is in one file so the wiring is obvious; in a real project the
settings block goes in `settings.py` and the views in `views.py`.

## What to notice

- **No HTTP call in the request path.** The middleware starts a background
  refresh thread; handlers read an in-memory dict. Local evaluation measured at
  ~2.6µs against ~4.9ms for a direct `POST /evaluate`.
- **`resolved_by` is honest.** It reports which rule won — `user_targeting`,
  `group_targeting`, `percentage_rollout`, `environment_override_*` or
  `default_value` — which is what you want in a support conversation.
- **The apps survive the flag service.** Stop the FlagForge API and hit
  `/checkout` again: it keeps serving the last snapshot. Start with the API
  already down and it serves the defaults passed at each call site.
