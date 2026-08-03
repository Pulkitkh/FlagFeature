from fastapi import Header

DEFAULT_ACTOR = "system"


def get_actor(x_actor: str | None = Header(default=None)) -> str:
    """Who is making this change, for the audit log.

    There is no auth layer yet, so the caller declares itself with an `X-Actor`
    header — the dashboard sends the signed-in user, scripts send their own
    name, and anything that sends nothing is recorded as "system". When real
    authentication lands, this is the single place that changes.
    """
    actor = (x_actor or "").strip()
    return actor[:100] if actor else DEFAULT_ACTOR
