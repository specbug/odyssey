#!/bin/bash
# Ensures the Podman machine and the odyssey stack are running AND healthy.
# Invoked by launchd on login and every 2 min (StartInterval).
# Silent no-op when healthy; logs only on action.
#
# Hardened against the failure modes we hit in production:
#   (1) Under boot-storm load (loadavg 20+), `podman machine inspect` reports
#       `"State": "running"` several seconds before the SSH socket is usable.
#       Fix: probe `podman ps` (which hits the socket) as the readiness gate.
#   (2) Multiple watchdog fires can stack if the previous run is still going;
#       two `podman machine start` invocations at once kill each other's
#       gvproxy with `signal caught`. Fix: pid-file lock at the top — if the
#       prior instance is still alive, silently exit.
#   (3) `podman compose up -d` can hang indefinitely when podman-compose
#       loses the socket mid-call. Fix: wrap with a watchdog that SIGKILLs
#       it after 120s so we don't hold the lock forever.
#   (4) `podman ps | grep -q` under `pipefail` reports 141 (SIGPIPE) whenever
#       grep exits on the match before podman finishes writing, which read as
#       "stack is down" on ~27% of ticks. Fix: capture, then match. See §2.
#
# IMPORTANT: launchd can't exec this file from ~/Documents due to macOS TCC.
# The real runtime copy lives at ~/.local/bin/odyssey-start.
# After editing this script, re-copy:
#     cp scripts/start.sh ~/.local/bin/odyssey-start && chmod +x ~/.local/bin/odyssey-start
#     launchctl kickstart -k "gui/$UID/in.sixeleven.odyssey"
set -euo pipefail

PODMAN=/opt/homebrew/bin/podman
PROJECT_DIR="/Users/rishitv/Documents/odyssey"
API_CONTAINER="odyssey_api_1"
HEALTH_URL="http://localhost:8000/health"
LOCK=/tmp/in.sixeleven.odyssey.lock
COMPOSE_TIMEOUT=120   # seconds; covers cold-start of 3 containers on a loaded VM

log() { echo "[odyssey-start] $(date '+%H:%M:%S') $*"; }

# --- single-instance lock (see header #2) ----------------------------------
# `mkdir` is the atomic gate; the pid file inside it only says who won, so it
# is written immediately after and never between the gate and a rival's check.
claim_lock() { echo "$$" > "$LOCK/pid"; trap 'rm -rf "$LOCK"' EXIT; }

live_owner() {
    local owner
    owner=$(cat "$LOCK/pid" 2>/dev/null || true)
    [[ -n "$owner" ]] && kill -0 "$owner" 2>/dev/null
}

if mkdir "$LOCK" 2>/dev/null; then
    claim_lock
else
    # Prior watchdog instance still alive — back off silently.
    live_owner && exit 0
    # No live owner, which is ambiguous: either a stale lock from a run that
    # died without cleanup, or a rival that won mkdir microseconds ago and has
    # not written its pid yet. Reclaiming on sight would let both instances run
    # `podman machine start` at once — the exact gvproxy-killing race this lock
    # exists to prevent. Wait out that window, then re-check before reclaiming.
    sleep 2
    live_owner && exit 0
    rm -rf "$LOCK"
    # Losing this mkdir means another instance reclaimed first; next tick retries.
    mkdir "$LOCK" 2>/dev/null || exit 0
    claim_lock
fi

# --- helpers ---------------------------------------------------------------
socket_ready() { "$PODMAN" ps >/dev/null 2>&1; }

# Run a command with a hard timeout. macOS has no GNU `timeout`.
# Usage: with_timeout <seconds> <cmd...>
with_timeout() {
    local secs="$1"; shift
    "$@" &
    local cmd_pid=$!
    (
        sleep "$secs"
        kill -TERM "$cmd_pid" 2>/dev/null && sleep 3
        kill -KILL "$cmd_pid" 2>/dev/null
    ) &
    local killer_pid=$!
    local rc=0
    wait "$cmd_pid" 2>/dev/null || rc=$?
    kill "$killer_pid" 2>/dev/null || true
    wait "$killer_pid" 2>/dev/null || true
    return "$rc"
}

# --- 1. ensure podman socket is live --------------------------------------
if ! socket_ready; then
    log "podman socket not ready, starting machine..."
    # `machine start` exits 125 if already running; silence that one line.
    "$PODMAN" machine start 2>&1 | grep -v "already running" || true
    # Poll up to 2 min for the socket. Fedora CoreOS boot + vfkit + SSH handshake
    # routinely takes 30–90s on a loaded mini.
    for _ in $(seq 1 60); do
        socket_ready && break
        sleep 2
    done
    if ! socket_ready; then
        log "machine socket never came up — will retry next cycle"
        exit 1
    fi
    log "socket ready."
fi

# --- 2. ensure stack is up ------------------------------------------------
# Capture first, match second. Piping `podman ps` straight into `grep -q` looks
# tidier but is wrong under `set -o pipefail`: grep -q exits the moment it hits
# the match, podman takes SIGPIPE writing the remaining names, and the pipeline
# reports 141. `!` then inverts that into "stack is down" and we pointlessly run
# `compose up`. It fired on ~27% of ticks (measured) and, because this branch
# ends in `exit 0`, it also skipped the health probe below on those ticks.
running=$("$PODMAN" ps --format '{{.Names}}' 2>/dev/null || true)
if ! grep -qx "$API_CONTAINER" <<<"$running"; then
    log "stack not up, bringing it up..."
    cd "$PROJECT_DIR"
    if with_timeout "$COMPOSE_TIMEOUT" "$PODMAN" compose up -d >/tmp/odyssey-start.compose.log 2>&1; then
        log "stack up."
    else
        log "compose up failed/timeout (see /tmp/odyssey-start.compose.log) — next cycle will retry"
    fi
    exit 0   # let containers warm; health probe on the next cycle
fi

# --- 3. health probe: 3x fail spaced 5s => api is wedged, restart it ------
health_ok() { curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; }

if health_ok; then exit 0; fi
sleep 5; health_ok && exit 0 || true
sleep 5; health_ok && exit 0 || true

log "/health failed 3x — restarting $API_CONTAINER"
"$PODMAN" restart "$API_CONTAINER" >/dev/null 2>&1 || log "restart failed"
