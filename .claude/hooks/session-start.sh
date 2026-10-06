#!/bin/bash
set -euo pipefail

# Only run this setup in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Use the Node pinned in .nvmrc (24, same as CI) instead of the image's Node 22.
# The lockfile is written by npm 11, which Node 24 bundles; the image's npm 10
# rejects it as out of sync. setup-node.sh also exports PATH for the rest of the
# session via CLAUDE_ENV_FILE, so lint, tests and Gradle's `node` calls match.
if NODE_BIN_DIR="$(bash "$CLAUDE_PROJECT_DIR/.claude/scripts/setup-node.sh")"; then
  export PATH="$NODE_BIN_DIR:$PATH"
  npm_ci=(npm ci)
else
  # Download failed: keep going on the image's Node, but run npm 11 for the install.
  echo "warning: Node setup failed; falling back to the image's Node" >&2
  npm_ci=(npx --yes npm@11 ci)
fi

# `npm ci` installs exactly what package-lock.json says and never rewrites it
# (`npm install` under npm 10 stripped "libc" fields and dirtied the tree).
#
# SessionStart also fires on resume, /clear, compaction and fork, and `npm ci`
# deletes node_modules first, so reinstalling every time would interrupt active
# work and fail on a package.json edit the lockfile doesn't reflect yet. Only
# install when the lockfile or Node version changed since the last install.
stamp_file="node_modules/.claude-install-stamp"
stamp="$(sha256sum package-lock.json | cut -d' ' -f1) node $(node --version)"
if [ "$(cat "$stamp_file" 2>/dev/null || true)" != "$stamp" ]; then
  "${npm_ci[@]}"
  echo "$stamp" > "$stamp_file"
else
  echo "npm ci skipped: node_modules already matches package-lock.json"
fi

# apps/client and apps/server depend on the built packages/game-logic output
# (dist/), so it must be built before lint/test/type-check will work there.
npm run build --workspace=packages/game-logic

# Android toolchain (SDK, NDK, emulator) for native builds. Non-fatal: a
# download hiccup shouldn't block the JS/TS workflow above. See docs/ANDROID.md.
bash "$CLAUDE_PROJECT_DIR/.claude/scripts/setup-android.sh" \
  || echo "warning: Android setup failed; native builds unavailable this session" >&2

# Local Redis for apps/server's Redis tests, which the pre-commit hook runs.
# Non-fatal for the same reason as above. Doesn't set REDIS_URL.
bash "$CLAUDE_PROJECT_DIR/.claude/scripts/start-redis.sh" \
  || echo "warning: Redis failed to start; server Redis tests will fail" >&2
