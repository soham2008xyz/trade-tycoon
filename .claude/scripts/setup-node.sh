#!/bin/bash
# Installs the Node major pinned in .nvmrc (and the npm it bundles) for Claude
# Code cloud sessions, and prints its bin directory on the LAST line of stdout.
# Logs go to stderr so callers can capture the path:
#
#   NODE_BIN_DIR="$(bash .claude/scripts/setup-node.sh)" && export PATH="$NODE_BIN_DIR:$PATH"
#
# Why: the cloud image ships Node 22 + npm 10, but package-lock.json is written
# by npm 11 (Node 24), which npm 10 rejects as out of sync, and CI runs Node 24.
# Using the same Node everywhere keeps `npm ci`, lint, tests and Gradle's `node`
# calls on one version.
#
# Idempotent: when the major is already installed it makes no network calls.
# Also appends a PATH export to $CLAUDE_ENV_FILE so every later command in the
# session sees it. Can be pasted into the cloud environment's Setup script so
# the download is cached in the environment instead of repeating per session.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# .nvmrc holds "24" or "v24.1.0" or "lts/*"; only a numeric major is supported.
MAJOR="$(tr -d 'v \r\n' < "$REPO_ROOT/.nvmrc" | cut -d. -f1)"
case "$MAJOR" in
  ''|*[!0-9]*) echo "setup-node: .nvmrc must start with a numeric major, got '$MAJOR'" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64)  ARCH=x64 ;;
  aarch64) ARCH=arm64 ;;
  *) echo "setup-node: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

# One directory per major; its contents track the latest patch at install time.
NODE_HOME="$HOME/.node/v$MAJOR"
BIN_DIR="$NODE_HOME/bin"

if [ ! -x "$BIN_DIR/node" ]; then
  base="https://nodejs.org/dist/latest-v$MAJOR.x"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  sums="$(curl -fsSL --retry 4 --retry-delay 2 "$base/SHASUMS256.txt")"
  line="$(grep -E "node-v[0-9.]+-linux-$ARCH\.tar\.xz$" <<<"$sums" | head -1)"
  [ -n "$line" ] || { echo "setup-node: no linux-$ARCH build found under $base" >&2; exit 1; }
  expected="${line%% *}"
  file="${line##* }"

  echo "setup-node: installing $file" >&2
  curl -fsSL --retry 4 --retry-delay 2 -o "$tmp/$file" "$base/$file"
  echo "$expected  $tmp/$file" | sha256sum -c --quiet - >&2 \
    || { echo "setup-node: checksum mismatch for $file" >&2; exit 1; }

  mkdir -p "$tmp/x"
  tar -xJf "$tmp/$file" -C "$tmp/x"
  rm -rf "$NODE_HOME"
  mkdir -p "$(dirname "$NODE_HOME")"
  mv "$tmp/x"/node-v* "$NODE_HOME"
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "setup-node: node $("$BIN_DIR/node" --version), npm $(PATH="$BIN_DIR:$PATH" "$BIN_DIR/npm" --version)" >&2
echo "$BIN_DIR"
