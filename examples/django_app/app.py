"""Minimal Django app consuming FlagForge, in a single file.

Run it:

    pip install -e ../../sdk django
    python app.py runserver 9001

Then:

    curl "http://localhost:9001/checkout?user_id=alice@example.com"

It assumes the FlagForge API is on http://localhost:8000 with a
`development` environment. Override with FLAGFORGE_URL / FLAGFORGE_ENV.

Kept to one file so the integration is obvious; in a real project the settings
block goes in settings.py and the views in views.py. The FlagForge-specific
parts are the `FLAGFORGE` setting and the one middleware entry.
"""

import os
import sys

import django
from django.conf import settings
from django.http import JsonResponse
from django.urls import path

API_URL = os.getenv("FLAGFORGE_URL", "http://localhost:8000")
ENVIRONMENT = os.getenv("FLAGFORGE_ENV", "development")

if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY="demo-only-not-a-real-secret",
        ALLOWED_HOSTS=["*"],
        ROOT_URLCONF=__name__,
        MIDDLEWARE=[
            # --- Wiring: one middleware entry ---
            "flagforge.integrations.django.FlagForgeMiddleware",
        ],
        # --- Wiring: one settings block ---
        FLAGFORGE={
            "API_URL": API_URL,
            "ENVIRONMENT": ENVIRONMENT,
            "REFRESH_INTERVAL": 15,
        },
        DATABASES={},
        INSTALLED_APPS=[],
    )


def checkout(request):
    """`request.flags` is attached by the middleware; the check hits memory only."""
    user_id = request.GET.get("user_id", "anonymous")
    decision = request.flags.evaluate("new-checkout-flow", user_id=user_id, default=False)

    return JsonResponse(
        {
            "user_id": user_id,
            "checkout": "express" if decision.value else "classic",
            "flag_value": decision.value,
            "resolved_by": decision.reason,
        }
    )


def all_flags(request):
    user_id = request.GET.get("user_id", "anonymous")
    return JsonResponse(request.flags.all_values(user_id=user_id))


def health(request):
    return JsonResponse({"status": "ok", "flagforge": request.flags.status()})


urlpatterns = [
    path("checkout", checkout),
    path("flags", all_flags),
    path("health", health),
]

def get_wsgi_application():
    """Entry point for gunicorn/uwsgi: `gunicorn app:get_wsgi_application()`."""
    from django.core.wsgi import get_wsgi_application as _get_wsgi_application

    django.setup()
    return _get_wsgi_application()


if __name__ == "__main__":
    from django.core.management import execute_from_command_line

    django.setup()
    execute_from_command_line(sys.argv)
