"""Healthchecks.io push heartbeat.

Called from a FastAPI lifespan task. Pings HEALTHCHECKS_URL every
HEARTBEAT_INTERVAL seconds. Silence on the remote end (no ping for >grace)
triggers the configured alert. Unset URL → no-op; the integration is fully
optional.

Why push, not pull: the mini sits behind a Cloudflare Tunnel with no
stable inbound address and may lose its ISP entirely. A heartbeat that
fires from inside the process detects "ISP down", "power out", "kernel
panic", and "python process wedged before uvicorn accepts connections"
equally — all surfaces that an external HTTP probe can mistake for each
other.
"""
from __future__ import annotations

import asyncio
import os

import httpx

_HEARTBEAT_INTERVAL_SECONDS = 60


async def _heartbeat_loop(url: str) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            try:
                await client.get(url)
            except Exception as exc:
                # Don't crash the loop on transient network errors;
                # Healthchecks.io's own silence-detection will alert if
                # several consecutive pings fail.
                print(f"[heartbeat] ping failed: {exc!r}")
            await asyncio.sleep(_HEARTBEAT_INTERVAL_SECONDS)


def start_heartbeat() -> asyncio.Task | None:
    """Spawn the heartbeat task if HEALTHCHECKS_URL is set, else no-op."""
    url = (os.getenv("HEALTHCHECKS_URL") or "").strip()
    if not url:
        return None
    print(f"[heartbeat] enabled — pinging every {_HEARTBEAT_INTERVAL_SECONDS}s")
    return asyncio.create_task(_heartbeat_loop(url))


async def stop_heartbeat(task: asyncio.Task | None) -> None:
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
