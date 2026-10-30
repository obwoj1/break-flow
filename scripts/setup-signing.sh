#!/usr/bin/env bash
# One-time setup: a self-signed "Break Flow Dev" code-signing certificate.
#
# Why: ad hoc signatures change with every build, so macOS treats each build as a new app —
# Accessibility has to be switched on again, and Electron's Keychain item ("Break Flow Safe
# Storage") prompts for access and freezes the app until you answer. Signing every build with the
# same certificate makes macOS see the same app each time.
#
# The certificate lives in its own keychain (not your login keychain) with a random password kept
# in ~/.config/break-flow/, so the build scripts can sign without asking for your Mac password.
#
# Undo: security delete-keychain ~/Library/Keychains/break-flow-dev.keychain-db
#       rm -r ~/.config/break-flow
set -euo pipefail

NAME="Break Flow Dev"
KEYCHAIN="$HOME/Library/Keychains/break-flow-dev.keychain-db"
PASSWORD_FILE="$HOME/.config/break-flow/signing-keychain-password"

if security find-identity -p codesigning "$KEYCHAIN" 2>/dev/null | grep -q "\"$NAME\""; then
    echo "Already set up: \"$NAME\" in $KEYCHAIN"
    exit 0
fi

mkdir -p "$(dirname "$PASSWORD_FILE")"
chmod 700 "$(dirname "$PASSWORD_FILE")"
if [[ ! -f "$PASSWORD_FILE" ]]; then
    (umask 077 && /usr/bin/openssl rand -hex 24 > "$PASSWORD_FILE")
fi
PASSWORD="$(cat "$PASSWORD_FILE")"

# A dedicated keychain that never auto-locks.
[[ -f "$KEYCHAIN" ]] || security create-keychain -p "$PASSWORD" "$KEYCHAIN"
security set-keychain-settings "$KEYCHAIN"
security unlock-keychain -p "$PASSWORD" "$KEYCHAIN"

# Certificate + private key, generated in a temp folder that's deleted afterwards.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/cert.cnf" <<'CNF'
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = Break Flow Dev
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CNF
# /usr/bin/openssl (LibreSSL) writes .p12 files the macOS `security` tool can import.
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$WORK/key.pem" -out "$WORK/cert.pem" -config "$WORK/cert.cnf" 2>/dev/null
P12_PASSWORD="$(/usr/bin/openssl rand -hex 16)"
/usr/bin/openssl pkcs12 -export -name "$NAME" -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
    -out "$WORK/identity.p12" -passout "pass:$P12_PASSWORD"

security import "$WORK/identity.p12" -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign >/dev/null
# Let codesign use the key without a GUI prompt.
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PASSWORD" "$KEYCHAIN" >/dev/null

# Add the keychain to the search list (keeping the existing ones) so codesign can find it.
EXISTING=()
while IFS= read -r line; do
    line="${line//\"/}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -n "$line" && "$line" != "$KEYCHAIN" ]] && EXISTING+=("$line")
done < <(security list-keychains -d user)
security list-keychains -d user -s "${EXISTING[@]}" "$KEYCHAIN"

echo "Created \"$NAME\" in $KEYCHAIN"
security find-identity -p codesigning "$KEYCHAIN" | grep "\"$NAME\""
