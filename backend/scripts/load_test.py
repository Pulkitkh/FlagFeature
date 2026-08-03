#!/usr/bin/env python
"""Load test the evaluation endpoint.

Confirms /evaluate stays fast under repeated requests, and shows what the Redis
cache is worth: the first request for a given user/flag/environment resolves
against Postgres, every repeat is served from cache.

    cd backend
    python scripts/load_test.py --requests 2000 --concurrency 16

Reports p50/p95/p99 and throughput, split by cache hit and miss. Read-only —
it never writes a flag.
"""

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT_URL = "http://localhost:8000"


def evaluate_once(base_url: str, flag_key: str, environment_key: str, user_id: str) -> tuple:
    payload = json.dumps(
        {
            "flag_key": flag_key,
            "environment_key": environment_key,
            "user_context": {"user_id": user_id},
        }
    ).encode()

    request = urllib.request.Request(
        f"{base_url}/evaluate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = json.loads(response.read())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        return (time.perf_counter() - started) * 1000, None, str(exc)

    return (time.perf_counter() - started) * 1000, bool(body.get("cached")), None


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(fraction * (len(ordered) - 1))))
    return ordered[index]


def summarize(label: str, durations: list[float]) -> None:
    if not durations:
        print(f"  {label:<14} —")
        return
    print(
        f"  {label:<14} n={len(durations):<6} "
        f"p50={percentile(durations, 0.50):6.2f}ms  "
        f"p95={percentile(durations, 0.95):6.2f}ms  "
        f"p99={percentile(durations, 0.99):6.2f}ms  "
        f"mean={statistics.fmean(durations):6.2f}ms"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--flag", default="new-checkout-flow")
    parser.add_argument("--environment", default="development")
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument(
        "--users",
        type=int,
        default=25,
        help="Distinct users to cycle through. Fewer users means a higher cache hit rate.",
    )
    args = parser.parse_args()

    print(
        f"Evaluating {args.flag} in {args.environment}: "
        f"{args.requests} requests, concurrency {args.concurrency}, {args.users} distinct users"
    )

    def task(index: int):
        return evaluate_once(
            args.url, args.flag, args.environment, f"load-user-{index % args.users}"
        )

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(task, range(args.requests)))
    elapsed = time.perf_counter() - started

    errors = [error for _, _, error in results if error]
    hits = [duration for duration, cached, error in results if not error and cached]
    misses = [duration for duration, cached, error in results if not error and cached is False]
    everything = hits + misses

    print(f"\nCompleted in {elapsed:.2f}s — {args.requests / elapsed:,.0f} req/s")
    summarize("all", everything)
    summarize("cache hits", hits)
    summarize("cache misses", misses)

    if everything:
        print(f"\n  cache hit rate: {len(hits) / len(everything) * 100:.1f}%")
    if errors:
        print(f"  errors: {len(errors)} (first: {errors[0]})")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
