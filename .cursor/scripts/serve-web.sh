#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Expo's dev server currently fails SSR here (Reanimated/Worklets mismatch).
# Static export is the supported web path for Cloud Agent GUI testing.
npm run build --workspace=apps/client
npx --yes serve apps/client/dist -l 8081
