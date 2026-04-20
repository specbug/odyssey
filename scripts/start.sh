#!/bin/bash
# Starts Podman machine (if not running) then brings up the compose stack.
# Invoked by the launchd agent on login.
set -euo pipefail

PODMAN=/opt/homebrew/bin/podman
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "[odyssey-start] $*"; }

# Start Podman VM if not already running
if ! "$PODMAN" machine inspect 2>/dev/null | grep -q '"Running"'; then
    log "Starting Podman machine..."
    "$PODMAN" machine start
    sleep 15
else
    log "Podman machine already running."
fi

log "Starting compose stack..."
cd "$PROJECT_DIR"
"$PODMAN" compose up -d --build

log "Done. Services are up."
