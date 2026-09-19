#!/usr/bin/env bash
# Create a Play-Protect-friendly upload keystore and print GitHub Actions secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
STORE="pelbu-release.jks"
ALIAS="pelbu"

if [[ -f "$STORE" ]]; then
  echo "Refusing to overwrite existing $STORE" >&2
  exit 1
fi

read -r -s -p "Keystore password: " STORE_PASS
echo
read -r -s -p "Key password (same is fine): " KEY_PASS
echo

keytool -genkeypair -v \
  -keystore "$STORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Pelbu LMS, OU=Education, O=Pelbu, L=Thimphu, ST=Thimphu, C=BT"

{
  echo "storePassword=$STORE_PASS"
  echo "keyPassword=$KEY_PASS"
  echo "keyAlias=$ALIAS"
  echo "storeFile=pelbu-release.jks"
} > keystore.properties

echo
echo "Add these GitHub Actions secrets:"
echo "  ANDROID_KEYSTORE_BASE64  = $(base64 < "$STORE" | tr -d '\n' | head -c 32)... (full value is the entire base64 file)"
echo "  ANDROID_KEYSTORE_PASSWORD"
echo "  ANDROID_KEY_ALIAS=$ALIAS"
echo "  ANDROID_KEY_PASSWORD"
echo
echo "SHA-256 fingerprint for Digital Asset Links:"
keytool -list -v -keystore "$STORE" -alias "$ALIAS" -storepass "$STORE_PASS" | grep "SHA256:"
echo
echo "Put the SHA-256 (colons removed or kept) in Vercel env ANDROID_CERT_SHA256"
