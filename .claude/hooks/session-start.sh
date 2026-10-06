#!/bin/bash
set -euo pipefail

# Only run this setup in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install

# apps/client and apps/server depend on the built packages/game-logic output
# (dist/), so it must be built before lint/test/type-check will work there.
npm run build --workspace=packages/game-logic

# Android toolchain (SDK, NDK, emulator) for native builds. Non-fatal: a
# download hiccup shouldn't block the JS/TS workflow above. See docs/ANDROID.md.
bash "$CLAUDE_PROJECT_DIR/.claude/scripts/setup-android.sh" \
  || echo "warning: Android setup failed; native builds unavailable this session" >&2
