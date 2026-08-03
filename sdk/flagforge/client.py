"""FlagForge client for consuming applications.

Holds the whole environment's flag configuration in memory, refreshes it on a
background thread, and evaluates locally — so a flag check inside a request
handler is a dictionary lookup, not an HTTP call.

    from flagforge import FlagForgeClient

    flags = FlagForgeClient(api_url="http://localhost:8000", environment="production")
    flags.start()

    if flags.is_enabled("new-checkout-flow", user_id="alice@example.com"):
        ...

Failure behaviour is deliberate: if the API is unreachable the client keeps
serving the last snapshot it fetched, and if it never managed to fetch one it
serves the caller's default. A flag service being down must never take the
application down with it.
"""

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

from flagforge.evaluator import Decision, evaluate

logger = logging.getLogger("flagforge")

DEFAULT_REFRESH_SECONDS = 30
DEFAULT_TIMEOUT_SECONDS = 5


class FlagForgeError(Exception):
    pass


class FlagForgeClient:
    """Thread-safe, in-memory flag cache with periodic background refresh."""

    def __init__(
        self,
        api_url: str,
        environment: str,
        refresh_interval: float = DEFAULT_REFRESH_SECONDS,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        actor: str | None = None,
        on_refresh: Callable[[dict], None] | None = None,
    ):
        self.api_url = api_url.rstrip("/")
        self.environment = environment
        self.refresh_interval = refresh_interval
        self.timeout = timeout
        self.actor = actor
        self.on_refresh = on_refresh

        # Guards every read/write of the cached snapshot. Reads are frequent and
        # short, writes happen once per refresh.
        self._lock = threading.RLock()
        self._flags: dict[str, dict] = {}
        self._group_members: dict[str, list[str]] = {}
        self._last_refresh: float | None = None
        self._last_error: str | None = None

        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ---------- lifecycle ----------

    def start(self, block_until_ready: bool = True) -> "FlagForgeClient":
        """Fetch once, then keep refreshing on a daemon thread.

        `block_until_ready=True` makes the first fetch synchronous so the app
        doesn't serve defaults during startup. It still doesn't raise if the
        API is down — it just starts with an empty cache and retries.
        """
        if block_until_ready:
            try:
                self.refresh()
            except FlagForgeError as exc:
                logger.warning("FlagForge: initial refresh failed (%s); serving defaults", exc)

        if self._thread is None or not self._thread.is_alive():
            self._stop.clear()
            self._thread = threading.Thread(
                target=self._refresh_loop,
                # Non-blocking start hasn't fetched anything yet, so the thread
                # fetches immediately rather than serving defaults for a whole
                # refresh interval first.
                args=(not block_until_ready,),
                name="flagforge-refresh",
                daemon=True,
            )
            self._thread.start()

        return self

    def stop(self, timeout: float = 2.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            self._thread = None

    def __enter__(self) -> "FlagForgeClient":
        return self.start()

    def __exit__(self, *exc_info) -> None:
        self.stop()

    def _refresh_loop(self, refresh_immediately: bool = False) -> None:
        if refresh_immediately:
            self._try_refresh()

        # Event.wait rather than sleep, so stop() is immediate.
        while not self._stop.wait(self.refresh_interval):
            self._try_refresh()

    def _try_refresh(self) -> None:
        try:
            self.refresh()
        except FlagForgeError as exc:
            logger.warning("FlagForge: refresh failed (%s); serving the last snapshot", exc)

    # ---------- refresh ----------

    def refresh(self) -> dict:
        """Pull a fresh snapshot. Raises FlagForgeError; the cache is left intact."""
        path = f"/snapshot/{urllib.parse.quote(self.environment, safe='')}"
        try:
            snapshot = self._get_json(path)
        except FlagForgeError as exc:
            # Recorded here rather than in the transport, so every failure path
            # shows up in status() — not just the ones inside _get_json.
            with self._lock:
                self._last_error = str(exc)
            raise

        with self._lock:
            self._flags = {flag["key"]: flag for flag in snapshot.get("flags", [])}
            self._group_members = snapshot.get("group_members", {})
            self._last_refresh = time.time()
            self._last_error = None

        if self.on_refresh is not None:
            try:
                self.on_refresh(snapshot)
            except Exception:  # pragma: no cover - a bad callback shouldn't break refresh
                logger.exception("FlagForge: on_refresh callback raised")

        return snapshot

    def _get_json(self, path: str) -> dict:
        request = urllib.request.Request(
            f"{self.api_url}{path}",
            headers={"Accept": "application/json", **({"X-Actor": self.actor} if self.actor else {})},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            raise FlagForgeError(f"could not reach {self.api_url}{path}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise FlagForgeError(f"invalid JSON from {path}: {exc}") from exc

    # ---------- evaluation ----------

    def evaluate(
        self,
        flag_key: str,
        user_id: str | None = None,
        groups: list[str] | None = None,
        default: Any = None,
        **user_attributes,
    ) -> Decision:
        """Resolve a flag locally. Unknown flags resolve to `default`."""
        context: dict[str, Any] = dict(user_attributes)
        if user_id is not None:
            context["user_id"] = user_id
        if groups is not None:
            context["groups"] = groups

        with self._lock:
            flag = self._flags.get(flag_key)
            group_members = self._group_members

            if flag is None:
                return Decision(flag_key, default, "flag_not_found")
            return evaluate(flag, context, group_members)

    def get_value(
        self,
        flag_key: str,
        user_id: str | None = None,
        groups: list[str] | None = None,
        default: Any = None,
        **user_attributes,
    ) -> Any:
        return self.evaluate(
            flag_key, user_id=user_id, groups=groups, default=default, **user_attributes
        ).value

    def is_enabled(
        self,
        flag_key: str,
        user_id: str | None = None,
        groups: list[str] | None = None,
        default: bool = False,
        **user_attributes,
    ) -> bool:
        """Truthiness of a flag. The common case for a boolean flag."""
        return bool(
            self.get_value(
                flag_key, user_id=user_id, groups=groups, default=default, **user_attributes
            )
        )

    def all_values(
        self, user_id: str | None = None, groups: list[str] | None = None
    ) -> dict[str, Any]:
        """Every flag resolved for one user — handy for bootstrapping a frontend."""
        with self._lock:
            keys = list(self._flags)
        return {key: self.get_value(key, user_id=user_id, groups=groups) for key in keys}

    # ---------- introspection ----------

    @property
    def is_ready(self) -> bool:
        with self._lock:
            return self._last_refresh is not None

    def status(self) -> dict:
        """Cache health — worth exposing on the consuming app's own /health."""
        with self._lock:
            return {
                "environment": self.environment,
                "api_url": self.api_url,
                "flags_cached": len(self._flags),
                "groups_cached": len(self._group_members),
                "last_refresh": self._last_refresh,
                "seconds_since_refresh": (
                    None if self._last_refresh is None else round(time.time() - self._last_refresh, 3)
                ),
                "last_error": self._last_error,
                "ready": self._last_refresh is not None,
            }
