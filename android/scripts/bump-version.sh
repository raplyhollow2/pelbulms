#!/usr/bin/env bash
# Bump android/version.properties
# Usage:
#   ./scripts/bump-version.sh patch|minor|major
#   ./scripts/bump-version.sh set 1.2.3
# Prints: VERSION_NAME=... VERSION_CODE=...
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="version.properties"

if [[ ! -f "$FILE" ]]; then
  echo "VERSION_NAME=1.0.0" > "$FILE"
  echo "VERSION_CODE=1" >> "$FILE"
fi

# shellcheck disable=SC1090
source <(grep -E '^(VERSION_NAME|VERSION_CODE)=' "$FILE" | sed 's/\r$//')

NAME="${VERSION_NAME:-1.0.0}"
CODE="${VERSION_CODE:-1}"
MODE="${1:-patch}"

bump_semver() {
  local ver="$1" part="$2"
  IFS='.' read -r major minor patch <<<"$ver"
  major=${major:-0}; minor=${minor:-0}; patch=${patch:-0}
  case "$part" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) echo "Unknown bump: $part" >&2; exit 1 ;;
  esac
  echo "${major}.${minor}.${patch}"
}

case "$MODE" in
  set)
    NEW_NAME="${2:?Usage: bump-version.sh set X.Y.Z}"
    if [[ ! "$NEW_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "version must be X.Y.Z" >&2
      exit 1
    fi
    ;;
  patch|minor|major)
    NEW_NAME="$(bump_semver "$NAME" "$MODE")"
    ;;
  none)
    NEW_NAME="$NAME"
    ;;
  *)
    echo "Usage: bump-version.sh patch|minor|major|none|set X.Y.Z" >&2
    exit 1
    ;;
esac

if [[ "$MODE" == "none" ]]; then
  NEW_CODE="$CODE"
else
  NEW_CODE=$((CODE + 1))
fi

{
  echo "# Canonical Android app version (read by Gradle + CI)."
  echo "# versionName = user-facing semver (GitHub release tag android-vX.Y.Z)"
  echo "# versionCode = integer that MUST increase with every update"
  echo "VERSION_NAME=$NEW_NAME"
  echo "VERSION_CODE=$NEW_CODE"
} > "$FILE"

echo "VERSION_NAME=$NEW_NAME"
echo "VERSION_CODE=$NEW_CODE"
