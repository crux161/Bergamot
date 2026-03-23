"""Small in-process rate limiter for auth-sensitive endpoints."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, status

_LOCK = threading.Lock()
_BUCKETS: dict[str, list[float]] = defaultdict(list)
_LOCKOUTS: dict[str, float] = {}


def _prune_attempts(values: list[float], *, now: float, window_seconds: int) -> list[float]:
    return [value for value in values if now - value < window_seconds]


def enforce_rate_limit(key: str, *, limit: int, window_seconds: int, detail: str) -> None:
    now = time.time()
    with _LOCK:
        attempts = _prune_attempts(_BUCKETS[key], now=now, window_seconds=window_seconds)
        if len(attempts) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
            )
        attempts.append(now)
        _BUCKETS[key] = attempts


def enforce_lockout(key: str, *, detail: str) -> None:
    now = time.time()
    with _LOCK:
        lockout_until = _LOCKOUTS.get(key)
        if lockout_until is None:
            return
        if lockout_until <= now:
            _LOCKOUTS.pop(key, None)
            return
        retry_after = max(1, int(lockout_until - now))
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(retry_after)},
    )


def record_failure(
    key: str,
    *,
    failure_limit: int,
    failure_window_seconds: int,
    lockout_seconds: int,
) -> None:
    now = time.time()
    with _LOCK:
        attempts = _prune_attempts(_BUCKETS[key], now=now, window_seconds=failure_window_seconds)
        attempts.append(now)
        _BUCKETS[key] = attempts
        if len(attempts) >= failure_limit:
            _LOCKOUTS[key] = now + lockout_seconds


def clear_failures(key: str) -> None:
    with _LOCK:
        _BUCKETS.pop(key, None)
        _LOCKOUTS.pop(key, None)
