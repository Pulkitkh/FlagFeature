"""FlagForge middleware client.

Caches an environment's flag configuration in memory, refreshes it in the
background, and evaluates flags locally so consuming applications don't pay an
HTTP round trip per flag check.
"""

from flagforge.client import FlagForgeClient, FlagForgeError
from flagforge.evaluator import Decision, deterministic_bucket, evaluate

__all__ = [
    "FlagForgeClient",
    "FlagForgeError",
    "Decision",
    "evaluate",
    "deterministic_bucket",
]

__version__ = "1.0.0"
