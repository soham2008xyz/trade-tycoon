# Guidelines for AI Agents

Welcome to the Trade Tycoon repository. You are an AI agent contributing to a
Monopoly-style trading game. This document is your operating manual: read it
fully before making changes, and update it whenever you learn something
durable that the next session will need to know.

**Memory files:** Whenever you discover a new insight, convention, gotcha, or
takeaway — whether by reading code, hitting a bug, or receiving feedback —
record it in the appropriate `.claude/memory/` file (user, feedback, project,
or reference) **and commit that file to the repo** in the same PR/commit as
the code that prompted the learning. Memory files that stay uncommitted are
invisible to the next agent session.

## 0. How this manual is split

There are **four** `AGENTS.md` files in this repo. Each rule lives in
**exactly one** of them — drift is the enemy.

- **This file** — strategic, cross-cutting: project context, the
  logic-first workflow, multi-workspace commands, architecture
  contracts that span workspaces, deployment-level gotchas.
- [`packages/game-logic/AGENTS.md`](packages/game-logic/AGENTS.md) —
  reducer pattern, vitest idioms for game rules, the no-platform-imports
  invariant.
- [`apps/server/AGENTS.md`](apps/server/AGENTS.md) — Express route +
  SSE patterns, supertest idioms, Vercel + ioredis gotchas, ioredis
  Lua-script pattern.
- [`apps/client/AGENTS.md`](apps/client/AGENTS.md) — file-extension
  discipline (.tsx vs .ts), the multiplayer-gating module, the two
  hotseat-vs-online patterns, EventSource wiring.

**Rule for editors of these files:** if you're tempted to copy a fact
from one file to another, stop. Either it belongs here (cross-cutting)
or there (workspace-specific) — pick one. Cross-references are fine;
duplication is not.

## 1. Project Context

**Trade Tycoon** is an npm-workspaces monorepo:

- **Client** (`apps/client`): React Native (Expo) — runs on iOS, Android,
  and the web via `react-native-web`. Online multiplayer talks REST + SSE;
  local hotseat play uses the same components without a server.
- **Server** (`apps/server`): Node.js + Express. **No Socket.IO** — REST
  endpoints under `/api/rooms/*` for client→server, Server-Sent Events at
  `GET /api/rooms/:id/events` for server→client. Deployed as a Vercel
  function.
- **Logic** (`packages/game-logic`): Pure-TypeScript reducer + types. No
  React, no Node-specific APIs. Imported by both client and server.

**Production stack:** Client on Vercel (static export), server on Vercel
(auto-detected Express), state + pub/sub on Upstash Redis. The server's
backends are pluggable: in-memory for tests/dev, Redis-backed when
`REDIS_URL` is set. See `DEPLOY.md` for the env-var reference.

**Key directives:**

- **Monorepo discipline.** Respect workspace boundaries. Don't edit
  `node_modules` or build artifacts.
- **Node 24 LTS** (see `.nvmrc`).
- **Logic-first.** All game rules and state mutations MUST live in
  `packages/game-logic`. The client and server only consume that
  reducer — they never duplicate rule logic.
- **State is immutable.** Reducers return new state objects.

## 2. Documentation & References

Read these before non-trivial work:

- `README.md` — setup, daily commands.
- `ARCHITECTURE.md` — directory layout, multiplayer data flow, why the
  pluggable backends.
- `DEPLOY.md` — provisioning Upstash, env vars, verifying a deploy.
- `SPECIFICATION.md` — feature implementation status.
- `apps/server/.env.example` — server env vars in one place.
- The three workspace-level `AGENTS.md` files listed in §0.

## 3. Development Workflow

The "logic-first" approach for any game feature:

1. **Logic** (`packages/game-logic/src`):
   - Add types in `types.ts`, action variants in `reducer.ts`.
   - Implement the state transition in the reducer.
   - **Mandatory:** vitest unit tests for the new rule. Run
     `npm test --workspace=packages/game-logic`. The pattern is in
     `packages/game-logic/AGENTS.md`.

2. **Server** (`apps/server`):
   - Most features need no server work — actions go through
     `gameReducer` unchanged. Only edit when an action has special
     authorization rules (e.g. only the host can do it, only the
     target can accept it). The route + test patterns are in
     `apps/server/AGENTS.md`.

3. **Client** (`apps/client`):
   - Render UI; dispatch actions through `OnlineGame.handleGameDispatch`
     (online — POSTs to `/api/rooms/:id/actions`) or `LocalGame`
     (offline — local reducer dispatch).
   - For any UI element whose visibility depends on hotseat-vs-online
     identity, follow the multiplayer-gating discipline described in
     `apps/client/AGENTS.md`.

## 4. Essential Commands

From the repo root:

- **Install:** `npm install`
- **Default dev loop:** `npm start` (api-server + expo-web in parallel)
- **Native dev loop:** `npm run start:native` (api-server + expo metro)
- **Backend only:** `npm run start:server`
- **All tests:** `npm test` (runs across workspaces — game-logic, server,
  client).
- **Per-workspace tests:**
  - `npm test --workspace=packages/game-logic`
  - `npm test --workspace=apps/server`
  - `npm test --workspace=apps/client`
- **Lint client:** `npm run lint`
- **Format:** `npm run format` (NOT `npm run prettier` — see Gotchas).
- **Web build:** `npm run build --workspace=apps/client`
- **Server build:** `npm run build --workspace=apps/server`

The pre-commit hook runs `lint && lint:md && format && test`. Don't
skip it.

## 5. Architecture Invariants (cross-workspace)

These are the load-bearing decisions that span workspaces. Don't undo
them without a strong reason and a discussion with the human partner.
Implementation details for each invariant live in the relevant
workspace's `AGENTS.md`.

### Server backends are pluggable through two interfaces

- `RoomStore` (atomic CRUD) and `EventBus` (room-scoped pub/sub) are
  the only ways the server reaches storage and broadcasts. Two impls
  each: in-memory for tests + dev, Redis-backed for production.
- Wiring is by `REDIS_URL` env var presence — set means Redis, unset
  means memory. See `apps/server/AGENTS.md` for the implementation
  layout and ioredis idioms.
- **The interface contract**: `RoomStore.update(roomId, mutator)` is
  an atomic compare-and-swap. The mutator must be a pure function of
  the input state because it may be called more than once on a CAS
  conflict.

### REST + SSE shapes (the wire contract between client and server)

- `POST /api/rooms` — create
- `POST /api/rooms/:id/join` — join
- `POST /api/rooms/:id/start` — start (host-only)
- `POST /api/rooms/:id/actions` — game actions (rolls, buys, trades, …)
- `POST /api/rooms/:id/leave` — remove the authenticated player from the room
  and, if the game is running, from the authoritative game state too
- `POST /api/rooms/:id/reconnect` — resume a session
- `GET /api/rooms/:id/events?userId=…` — SSE stream

The server's `handleGameAction` validates `action.playerId === userId`
**before** handing to the reducer; the reducer adds role-specific
checks (only-host-can-start, only-target-can-accept-trade, …). Both
layers participate in the security boundary.

### Resume is opt-in, never auto

`OnlineGame` does NOT auto-restore from `localStorage` on mount. The
multiplayer menu surfaces a "Resume Game" button when a session is
stored; that's the only entry point. **Do not add silent auto-resume
on Create/Join intent** — it caused a host-impersonation bug whose
debugging history is in `git log`. Implementation lives in
`apps/client/AGENTS.md`.

### Trade authorization rejections are explicit on the server path

Most illegitimate actions in game logic still no-op by returning the
input state unchanged. But there is one important exception:
`ACCEPT_TRADE` from a non-target and `CANCEL_TRADE` from a
non-initiator now produce an explicit rejection sentinel in the
detailed reducer path used by the server.

Two consequences:

- Game-logic exposes a server-facing helper that can return the
  sentinel, while the client-facing `gameReducer` wrapper still
  collapses that back to "unchanged state" for `useReducer`.
- Server tests for those rogue trade actions now assert HTTP 409
  `Action rejected`, while the higher-level `userId !== action.playerId`
  impersonation guard remains its own earlier rejection path.

If you change this behaviour, both workspace files need updating —
they're the only places that document this contract in detail.

## 6. Cross-cutting gotchas

Workspace-specific gotchas live in the workspace files. These are the
ones that bite multiple workspaces or the repo as a whole.

### TypeScript 6 — `rootDir` is no longer inferred

Both `apps/server/tsconfig.json` and `packages/game-logic/tsconfig.json`
explicitly set `"rootDir": "./src"`. TS6 introduced `TS5011` —
ambiguous root directories now error instead of being best-effort
inferred. Any new tsconfig that has a `src/` and a separate `outDir`
needs the same field.

### `format` script, not `prettier`

The repo's prettier-runner npm script is named `format`, not
`prettier`. Naming a script `prettier` shadows the binary in
`node_modules/.bin` and makes `expo-doctor` flag a script-vs-bin
conflict. The husky pre-commit hook runs `npm run format`; the
lint-staged config also references `prettier --write` directly via
the bin. Don't rename either back to `prettier`.

## 7. Coding Standards

- **TypeScript:** strict mode. Avoid `any`. Prefer narrow types and
  derived discriminated unions.
- **Pure-function bias:** business rules and visibility predicates
  live in pure functions, separate from React or HTTP code, so
  they're testable in isolation.
- **Comment the _why_, not the what.** Especially for non-obvious
  branches (cold-start guards, hotseat-vs-online diverging behaviour,
  security checks). The next agent should understand the constraint,
  not just the mechanics.
- **Never write `// eslint-disable-next-line` without a tied comment**
  explaining why. Past dead disables have rotted.

## 8. Verification

After every change:

1. **Read** the modified files to verify content.
2. **Run** the relevant test command(s):
   - Game-logic change → `npm test --workspace=packages/game-logic`.
   - Server route or RoomManager change → `npm test --workspace=apps/server`.
   - Client gating predicate change → `npm test --workspace=apps/client`.
   - Anything else → `npm test`.
3. **Run lint** (`npm run lint`) for client changes.
4. **Run a build** if you touched server entry points or wiring
   (`npm run build --workspace=apps/server`).
5. If you've changed deployment-relevant code (env var handling,
   Redis wiring, route shapes), check `DEPLOY.md` is still accurate.
6. Update `SPECIFICATION.md` when a feature ships.

## 9. When something is wrong in production

- Vercel project IDs are in `.claude/launch.json`. Use the Vercel MCP
  tools (or dashboard) to fetch runtime logs filtered to `level=error`.
- The `/api/health` endpoint returns 200 OK and is the cheapest
  "is the function deploying / starting at all" probe.
- If you see `FUNCTION_INVOCATION_FAILED` on every route → module-load
  crash in the server. Check the Vercel + ioredis gotchas in
  `apps/server/AGENTS.md` first.
- If state behaves inconsistently across browsers → confirm
  `REDIS_URL` is still set on the Vercel project; without it, the
  server falls back to in-memory and the multi-instance bug returns.

---

## End of Guidelines
