#!/usr/bin/env bash
# Rebuilds Break Flow and (re)launches it.
#
# Every ad-hoc-signed build looks like a brand-new app to macOS, so the old Accessibility
# grant stops working while still showing as "on" in System Settings. We clear it here so
# macOS asks again cleanly. Pass --keep-perms to skip that.
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="com.obwoj1.breakflow"

scripts/build-app.sh

pkill -x BreakFlow 2>/dev/null || true

if [[ "${1:-}" != "--keep-perms" ]]; then
    tccutil reset Accessibility "$BUNDLE_ID" >/dev/null 2>&1 || true
fi

open "build/Break Flow.app"
echo "Break Flow is running — look for the waveform icon in your menu bar."
