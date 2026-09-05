#!/bin/bash
# One-shot system tuning for this Mac mini to behave like a 24/7 server.
# Idempotent — safe to run repeatedly. Needs sudo.
#
#   sudo bash scripts/harden-mac-server.sh
#
# What this does (and why):
#   - Disables every flavor of sleep/standby/powernap (a server that naps misses
#     requests and loses its Cloudflare Tunnel).
#   - Reboots automatically on kernel panic and on power-failure recovery.
#   - Disables auto-install of macOS point releases (unplanned reboots are the
#     #1 cause of outage on a headless mini). Keeps Rapid Security Responses
#     on — those rarely reboot and plug real holes.
#   - Schedules a weekly clean reboot Monday 04:00 to flush kernel/memory cruft.
#   - Kills nuisance daemons that eat CPU or block the user session: local
#     Time Machine snapshots, App Nap on the server user.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "error: run with sudo (needs pmset -c, systemsetup, /Library/Preferences writes)" >&2
    exit 1
fi

# User whose session owns the podman machine. If you ever move this setup to a
# different user, update this line.
SERVER_USER="rishitv"

say() { printf '\n=== %s ===\n' "$*"; }

say "power: disable every form of sleep / hibernation / standby"
# -c = AC/charger profile (only one that matters on a Mac mini, no battery).
# womp=1 keeps Wake-on-LAN for admin use.
pmset -c \
    sleep 0 \
    disksleep 0 \
    displaysleep 15 \
    powernap 0 \
    standby 0 \
    hibernatemode 0 \
    autopoweroff 0 \
    autorestart 1 \
    womp 1 \
    ttyskeepawake 1
# Stop a random Bluetooth device from waking the machine mid-nap.
pmset -a bluetoothwake 0 2>/dev/null || true

say "panic / power recovery: auto-reboot on both"
# setrestartpowerfailure returns Error:-99 on Apple Silicon — the GUI toggle
# in Energy Saver is the supported path. We set autorestart=1 above as the
# equivalent CLI knob.
systemsetup -setrestartfreeze on >/dev/null

say "software update: stop auto-installing point releases, keep security responses"
# App Store and OS updates — download is fine, install must be manual.
defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
defaults write /Library/Preferences/com.apple.commerce AutoUpdate -bool false
# Rapid Security Responses and XProtect/MRT data — LEAVE ON.
defaults write /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate ConfigDataInstall -bool true
softwareupdate --schedule off >/dev/null 2>&1 || true

# Read the one setting back. On macOS 26 the softwareupdated daemon can hold its
# own view and quietly ignore this write, which is not hypothetical: the mini
# auto-installed 26.6.2 and rebooted itself on 2026-09-04 with the write already
# applied. Failing loudly beats a script that reports success and changes nothing
# — an unattended reboot is the single most likely cause of an outage here.
if [[ "$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates 2>/dev/null || echo 1)" != "0" ]]; then
    cat >&2 <<'WARN'

  !! AutomaticallyInstallMacOSUpdates did NOT stick (still enabled).
     macOS can still reboot this machine unattended for a point release.
     Turn it off by hand, then re-run to confirm:
       System Settings -> General -> Software Update -> (i) beside
       "Automatic Updates" -> turn OFF "Install macOS updates".
     Leave "Install Security Responses and system files" ON.

WARN
fi

say "weekly clean reboot: Monday 04:00"
# Replaces any prior schedule. `pmset repeat` holds exactly one entry.
pmset repeat restart M 04:00:00

say "Time Machine: disable local snapshots (they silently fill the disk)"
tmutil disablelocal 2>/dev/null || true

say "App Nap: off for the server user ($SERVER_USER)"
sudo -u "$SERVER_USER" defaults write NSGlobalDomain NSAppSleepDisabled -bool YES

say "done. verify with: pmset -g ; pmset -g sched ; defaults read /Library/Preferences/com.apple.SoftwareUpdate"
