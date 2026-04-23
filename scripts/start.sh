#!/bin/bash
# Ensures the Podman machine and the odyssey stack are running.
# Invoked by launchd on login and every 5 min (StartInterval).
# Silent no-op when healthy; logs only on recovery.
#
# IMPORTANT: launchd can't exec this file from ~/Documents due to macOS TCC.
# The real runtime copy lives at ~/.local/bin/odyssey-start.
# After editing this script, re-copy:
#     cp scripts/start.sh ~/.local/bin/odyssey-start && chmod +x ~/.local/bin/odyssey-start
set -euo pipefail

PODMAN=/opt/homebrew/bin/podman
PROJECT_DIR="/Users/rishitv/Documents/odyssey"
CONTAINER="odyssey_api_1"

log() { echo "[odyssey-start] $(date '+%H:%M:%S') $*"; }

# Ensure machine is running. `machine start` is not safe to call when already running
# (exits 125), and two agents can race at login, so tolerate that and poll for ready.
if ! "$PODMAN" machine inspect 2>/dev/null | grep -q '"State": "running"'; then
    log "Podman machine not running, starting..."
    "$PODMAN" machine start 2>&1 | grep -v "already running" || true
    for _ in $(seq 1 30); do
        "$PODMAN" machine inspect 2>/dev/null | grep -q '"State": "running"' && break
        sleep 2
    done
fi

# Ensure container is up. Silent if already running.
if ! "$PODMAN" ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    log "Container $CONTAINER not running, bringing up stack..."
    cd "$PROJECT_DIR"
    "$PODMAN" compose up -d
    log "Done."
fi
