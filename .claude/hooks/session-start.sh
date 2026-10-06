#!/bin/bash
set -euo pipefail

# Only run this setup in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# `npm ci` installs exactly what package-lock.json says and never rewrites it
# (`npm install` here stripped "libc" fields and dirtied the tree every
# session). The lockfile comes from npm 11 (Node 24, see .nvmrc and CI), and
# the container's npm 10 rejects it as out of sync, so run npm 11 explicitly.
npx --yes npm@11 ci

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
