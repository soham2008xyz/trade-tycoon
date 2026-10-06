#!/bin/bash
# Starts a local Redis on 127.0.0.1:6379 for Claude Code cloud sessions.
# apps/server's Redis tests (RedisRoomStore, RedisEventBus, RedisPresenceStore)
# connect there, and the pre-commit hook runs them, so without it every commit
# fails with ECONNREFUSED. Idempotent: does nothing when Redis already answers.
#
# Deliberately does NOT export REDIS_URL: setting it would switch the dev
# server from in-memory storage to Redis (see AGENTS.md section 5).
set -euo pipefail

if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
  echo "start-redis: already running"
  exit 0
fi

if ! command -v redis-server >/dev/null 2>&1; then
  echo "start-redis: redis-server not found; installing" >&2
  # Cloud sessions run as root; fall back to sudo elsewhere.
  SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"
  $SUDO apt-get update -qq >/dev/null
  $SUDO apt-get install -y -qq redis-server >/dev/null
fi

# No persistence: test data is throwaway and a snapshot file would dirty the repo dir.
redis-server --bind 127.0.0.1 --port 6379 --daemonize yes --save "" --appendonly no >/dev/null

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    echo "start-redis: ready on 127.0.0.1:6379"
    exit 0
  fi
  sleep 0.5
done
echo "start-redis: Redis did not start" >&2
exit 1
