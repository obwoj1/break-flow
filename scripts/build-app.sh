#!/usr/bin/env bash
# Builds Break Flow and wraps it into build/Break Flow.app
#
# Usage: scripts/build-app.sh            (release build)
#        CONFIG=debug scripts/build-app.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="${CONFIG:-release}"
APP="build/Break Flow.app"

# The default (swift-build) build system in Command Line Tools 26 fails to start, so use the
# classic one. See CONTEXT.md → Known issues.
swift build -c "$CONFIG" --build-system native 2>&1 | grep -v "has been deprecated" || true
BIN="$(swift build -c "$CONFIG" --build-system native --show-bin-path 2>/dev/null)/BreakFlow"
[[ -x "$BIN" ]] || { echo "Build failed: $BIN not found" >&2; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/BreakFlow"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Ad-hoc signature ("-") unless SIGN_IDENTITY names a real certificate.
codesign --force --sign "${SIGN_IDENTITY:--}" "$APP"

echo "Built: $APP"
