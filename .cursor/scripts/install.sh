#!/usr/bin/env bash
set -euo pipefail

cd /workspace

npm ci
npm run build --workspace=packages/game-logic
