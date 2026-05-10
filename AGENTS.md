# Guidelines for AI Agents

Welcome to the Trade Tycoon repository. You are an AI agent contributing to a
Monopoly-style trading game. This document is your operating manual: read it
fully before making changes, and update it whenever you learn something
durable that the next session will need to know.

## 1. Project Context

**Trade Tycoon** is an npm-workspaces monorepo:

- **Client** (`apps/client`): React Native (Expo) — runs on iOS, Android, and
  the web via `react-native-web`. Online multiplayer talks REST + SSE; local
  hotseat play uses the same components without a server.
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
  `packages/game-logic`. The client and server only consume that reducer —
  they never duplicate rule logic.
- **State is immutable.** Reducers return new state objects.

## 2. Documentation & References

Read these before non-trivial work:

- `README.md` — setup, daily commands.
- `ARCHITECTURE.md` — directory layout, multiplayer data flow, why the
  pluggable backends.
- `DEPLOY.md` — provisioning Upstash, env vars, verifying a deploy.
- `SPECIFICATION.md` — feature implementation status.
- `apps/server/.env.example` — server env vars in one place.

## 3. Development Workflow

The "logic-first" approach for any game feature:

1. **Logic** (`packages/game-logic/src`):
   - Add types in `types.ts`, action variants in `reducer.ts`.
   - Implement the state transition in the reducer.
   - **Mandatory:** vitest unit tests for the new rule. Run
     `npm test --workspace=packages/game-logic`.

2. **Server** (`apps/server`):
   - Most features need no server work — actions go through `gameReducer`
     unchanged. Only edit when an action has special authorization rules
     (e.g. only the host can do it, only the target can accept it).
   - If you DO change the action surface, update or add a test in
     `apps/server/src/routes/rooms.test.ts`.

3. **Client** (`apps/client`):
   - Render UI; dispatch actions through `OnlineGame.handleGameDispatch`
     (online — POSTs to `/api/rooms/:id/actions`) or `LocalGame` (offline —
     local reducer dispatch).
   - **For any UI element whose visibility depends on hotseat-vs-online
     identity, add a pure predicate to
     `apps/client/components/multiplayer-gating.ts` and a unit test in
     `multiplayer-gating.test.ts`.** See "UI gating discipline" below.

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

The pre-commit hook runs `lint && lint:md && format && test`. Don't skip it.

## 5. Architecture Invariants

These are the load-bearing decisions; please don't undo them without a
strong reason and a discussion with the human partner.

### Server backends are pluggable through two interfaces

- `apps/server/src/store/RoomStore.ts` — atomic CRUD for room state
  (`get`, `create`, `update`, `delete`). `update` is a CAS read-modify-write
  whose mutator must be a pure function of the input state because it may
  retry on Redis WATCH conflict. Two implementations: `InMemoryRoomStore`
  (tests + dev), `RedisRoomStore` (prod, uses a registered Lua script via
  `defineCommand`).
- `apps/server/src/events/EventBus.ts` — room-scoped pub/sub. Two
  implementations: `InMemoryEventBus`, `RedisEventBus` (each subscriber gets
  a `redis.duplicate()`'d connection because SUBSCRIBE puts a connection in
  subscriber mode).
- Wiring lives in `apps/server/src/index.ts`'s `buildBackends()`. Selection
  is by `REDIS_URL` env var presence — set means Redis, unset means memory.

### REST + SSE shapes

- `POST /api/rooms` — create
- `POST /api/rooms/:id/join` — join
- `POST /api/rooms/:id/start` — start (host-only)
- `POST /api/rooms/:id/actions` — game actions (rolls, buys, trades, …)
- `POST /api/rooms/:id/reconnect` — resume a session
- `GET /api/rooms/:id/events?userId=…` — SSE stream

`handleGameAction` validates `action.playerId === userId` BEFORE handing
to the reducer; the reducer adds role-specific checks
(only-host-can-start, only-target-can-accept-trade, …).

### Client UI gating discipline

The client renders the same components in two play modes: **local hotseat**
(one device, one user passes it between players) and **online multiplayer**
(one browser per user). Some UI surfaces need different visibility rules
in each mode.

- **Action buttons (Roll, Buy, End Turn, …)** — gated on `isMyTurn` in
  `Board.tsx`. The unifying trick is that `myPlayerId === state.currentPlayerId`
  is always true in hotseat (`LocalGame` sets it that way), so the same
  expression works in both modes.
- **Auction bid/fold and trade Accept/Reject/Cancel** — these are NOT tied
  to the outer-game turn (auctions rotate among bidders; trades involve
  initiator + target who may not be the active player). The unifying trick
  doesn't work here. They need an explicit `isMultiplayer` flag plumbed
  from `OnlineGame` through `GameUI` → `Board` → modal.
- **The visibility rule for any new such surface** belongs in
  `apps/client/components/multiplayer-gating.ts` as a pure predicate,
  unit-tested in `multiplayer-gating.test.ts`. Components import the
  predicate; they don't re-implement the rule. This is the only client-side
  test surface today (vitest in node env, no React Testing Library).

### Resume is opt-in

`OnlineGame` does NOT auto-restore from `localStorage` on mount. The
multiplayer menu shows a "Resume Game" button when a session is stored, and
clicking it routes to `OnlineGame` with `initialMode='resume'`. That mode
calls `POST /api/rooms/:id/reconnect`; on success it hydrates state, on 404
(`session_expired`) it clears `localStorage` and bounces back. **Do not add
silent auto-resume on Create/Join intent** — that was the impersonation bug
that motivated the current design.

## 6. Gotchas & Hard-Won Lessons

These are landmines past sessions stepped on. Please don't relearn them.

### Vercel + ioredis

- **DO NOT call `attachDatabasePool(redis)` from `@vercel/functions`** for
  an `ioredis` instance. The 3.5.x runtime detects pools via
  `'socket' in dbPool.options`, which is the **node-redis** option shape,
  not ioredis (which is flat: `{ host, port, … }`). It throws
  `Unsupported database pool type` at module load and crashes every request
  with `FUNCTION_INVOCATION_FAILED`. Their docs say "Redis (ioredis)" is
  supported; the docs are wrong relative to their runtime check.
- **DO NOT set `enableOfflineQueue: false`** on the ioredis client. Vercel
  cold starts run `new Redis(url)` and then immediately receive HTTP
  requests; with the queue disabled, the first command fires before the
  TLS handshake completes and you get `Stream isn't writeable`. Keep the
  default `true` so commands buffer through the handshake. Use
  `maxRetriesPerRequest` to bound retries when Redis is genuinely down.
- **WebSocket upgrades return HTTP 400** on standard Vercel functions —
  Vercel doesn't terminate WebSockets. Don't try Socket.IO or `ws`. SSE
  works because Vercel functions can hold a streaming response open up to
  the 300s timeout (the browser's `EventSource` auto-reconnects on close).
- **Each polling/HTTP request can land on a different lambda instance**
  with its own memory, so any in-process state is lost. This is the
  original reason we use Redis for room state and Redis pub/sub for fan-out.
- **`ioredis-mock` instances share an underlying in-memory map.** Always
  `await redis.flushall()` in `beforeEach` or one test will pollute the
  next.

### Express on Vercel

- **Export the app and only `app.listen` when run as the main module.**

  ```ts
  export default app;
  if (require.main === module) {
    app.listen(PORT, ...);
  }
  ```

  Vercel auto-detects Express via the default export; binding a port at
  module load breaks the auto-mount. Tests also benefit (no port grab).

### TypeScript 6

- **Add `"rootDir": "./src"`** to any tsconfig where the existing layout
  has `src/` and a separate `outDir`. TS6 introduces `TS5011`: rootDir is
  no longer best-effort inferred when ambiguous.

### ioredis Lua scripts

- **Prefer `redis.defineCommand('name', { numberOfKeys, lua })`** over
  invoking the raw Redis `EVAL` command from JavaScript. ioredis caches the
  script (SCRIPT LOAD + EVALSHA on call) for free, and the local-string
  spelling of the JS method also triggers a substring-based security
  hook in this harness even though it has nothing to do with JavaScript
  evaluation. `defineCommand` sidesteps both issues.

### Multiplayer-gating tests

- The `multiplayer-gating.ts` module is intentionally React-free so its
  tests run in plain Node. **Don't import from a `.tsx` file in those
  tests** — that pulls in React Native and breaks the no-DOM environment.
  Components import gating predicates *from* the module; tests import the
  same module directly.

### Reducer no-ops

- The game-logic reducer **silently no-ops** on illegitimate trade actions
  (non-target ACCEPT_TRADE, non-initiator CANCEL_TRADE) instead of
  signaling rejection. The server-side route then returns HTTP 200 with
  unchanged state — not 409 — because the action was technically applied.
  When writing server tests for these boundaries, **assert state-is-
  unchanged, not 409**. The 409 path is only for the
  `userId !== action.playerId` impersonation guard.

### Pre-commit hook

- The `format` npm script (not `prettier`) is intentional. Naming a script
  `prettier` shadows the binary in `node_modules/.bin` and makes
  `expo-doctor` flag a script-vs-bin conflict. The husky pre-commit hook
  runs `npm run format`.

## 7. Coding Standards

- **TypeScript:** strict mode. Avoid `any`. Prefer narrow types and
  derived discriminated unions.
- **Pure-function bias:** business rules and visibility predicates live in
  pure functions, separate from React or HTTP code, so they're testable in
  isolation.
- **Comment the *why*, not the what.** Especially for non-obvious branches
  (cold-start guards, hotseat-vs-online diverging behaviour, security
  checks). The next agent should understand the constraint, not just the
  mechanics.
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
5. If you've changed deployment-relevant code (env var handling, Redis
   wiring, route shapes), check `DEPLOY.md` is still accurate.
6. Update `SPECIFICATION.md` when a feature ships.

## 9. When something is wrong in production

- Vercel project IDs are in `.claude/launch.json`. Use the Vercel MCP tools
  (or dashboard) to fetch runtime logs filtered to `level=error`.
- The `/api/health` endpoint returns 200 OK and is the cheapest "is the
  function deploying / starting at all" probe.
- If you see `FUNCTION_INVOCATION_FAILED` on every route → module-load
  crash. Check the most recent code diffs against the Vercel + ioredis
  gotchas above before reaching for anything fancier.
- If state behaves inconsistently across browsers → confirm `REDIS_URL` is
  still set on the Vercel project; without it, the server falls back to
  in-memory and the multi-instance bug returns.

---

## End of Guidelines
