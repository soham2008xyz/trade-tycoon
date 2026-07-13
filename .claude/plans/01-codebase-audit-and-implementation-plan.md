# Trade Tycoon — Codebase Audit & Remediation Plan

## Context

Full audit of the monorepo (apps/client Expo RN+web, apps/server Express+SSE+Redis/in-memory store, packages/game-logic pure-TS reducer engine). Three parallel exploration passes covered server/game-logic, client, and tests/CI; top findings were verified directly against source. The goal is a phased remediation: security first, then correctness, performance, tests/CI, and cleanup.

**Overall health:** game-logic is well-tested (147 tests, all reducer actions), server has 87 tests, TS strict everywhere, docs accurate. The problems concentrate in: a broken auth model, missing input validation, untested multiplayer client code (`OnlineGame.tsx`, 592 LOC, 0 tests), and CI gaps (no lint, no server typecheck).

## Findings Summary

### Critical
- **C1 — Full player impersonation.** `Player.id` is both the auth credential (`RoomManager.ts:277` checks `action.playerId === userId`) and broadcast to every client in every state event (`stripBoard` only removes `board`). Any player can act as any other: spend their money, accept trades, mortgage assets, hijack their session via `reconnect`.

### High
- **H1 — No numeric validation on client input** (`routes/rooms.ts:88` only checks `action.type` is a string). Negative trade `offer.money` mints money; string money corrupts balances via concatenation (`reducer.ts:815-891`); non-numeric `PLACE_BID.amount` slips past both guards.
- **H2 — No error middleware.** Server is Express 5 (async rejections ARE forwarded), but there's no JSON error handler, and `RedisRoomStore.update` throws a bare error after 5 CAS retries → unstructured HTML 500s under contention.
- **H3 — Client falls back to `localhost:3001`** when `EXPO_PUBLIC_SERVER_URL` is unset (`components/online-platform.ts:7-9`) → production builds silently break online play.
- **H4 — `OnlineGame.tsx` (all multiplayer client logic: SSE, polling, POSTs, reconnect) has zero tests.**

### Medium (server/engine)
- **M1** Reducer calls `Math.random` (dice `reducer.ts:320-321`, cards `:399,:434`) inside the CAS-retried `store.update` mutator — violates the documented purity contract; Redis CAS retry silently re-rolls.
- **M2** `ACCEPT_TRADE` never transfers/forbids `houses` on traded properties → orphaned house records, vanished buildings.
- **M3** `GameState.logs` grows unbounded; full array re-broadcast + persisted every action.
- **M4** Static 40-tile board stored in every room record and CAS-compared every write (stripped only from responses); reducer never reads `state.board`.
- **M5** Rejected/no-op actions still broadcast full state to everyone and return `{ok:true}`.
- **M6** SSE write errors only `console.warn`, never unsubscribe (`routes/events.ts:52-59`) → EventBus handler + Redis subscriber connection leak per dead stream.
- **M7** `DECLARE_BANKRUPTCY` just filters the player out; dangling `activeTrade`/auction refs, no asset cleanup path shared with `removePlayerFromGame`.
- **M8** Player names uncapped at create/join (only `updatePlayer` caps at 15) → up-to-64kB names stored and broadcast.

### Medium (client)
- **M9** `errorMessage`/`toastMessage` live in shared broadcast `GameState` → all players see each other's private errors; any player's DISMISS clears it for everyone.
- **M10** Toast auto-dismiss timer resets on every re-render (effect depends on inline closure) → toast persists indefinitely during online update churn.
- **M11** `PropertyManager` binds to `currentPlayerId` (active player), not the local user, and stays open across turn changes → can act on the wrong player's assets.
- **M12** Native poller replaces all state every 2s with no change detection or backoff.
- **M13** No memoization on hot path: `GameUI` rebuilds all closures/props per render; `Board`/`Tile`/`PlayerToken` un-memoized; `getOwner` is O(players×properties) × 40 tiles per render.
- **M14** No in-flight guard on create/join/start/action handlers → double-submit (two rooms, duplicate actions).

### Medium (CI/tooling)
- **M15** CI has no lint step and no typecheck for server or game-logic (vitest/esbuild strips types unchecked — server type errors pass green). ESLint config covers client only.

### Low (bundled cleanup)
Duplicated `Action` vs `GameAction` unions; dead fields (`lastDiceRoll`, phase `'end'`, `TradeRequest.status`); `RESET_GAME` crash on empty players; `Math.random` ids/room codes; CORS `*`; doubles bonus roll not enforced; no house supply limit; double broadcasts on start/leave; client: overlapping toast channels, no back-button handling, `onTouchEnd` backdrop (no mouse), `price && ...` 0-value rendering, non-lazy `createInitialState`, name-based log colors, `@ts-ignore`, TradeModal non-functional setState, no duplicate-color validation; tooling: dead `lint-staged` config, reanimated 4.5.0 vs 4.4.1 override mismatch, pre-commit runs full suite + `format` doesn't re-stage, no `pull_request` CI trigger.

---

## Phase 1 — Security (C1, H1, M8) — *ship server+client together (breaking wire change)*

### 1a. Session tokens (C1)
- On create/join: `token = crypto.randomBytes(24).toString('base64url')`; store `sessions: Record<token, playerId>` **inside** `LobbyState` (`packages/game-logic/src/socket-types.ts`) — rides existing CAS atomicity + room TTL. Store raw token (Redis already holds authoritative state).
- New `apps/server/src/serialize.ts`: `toPublicLobbyState` / `toPublicGameState` omitting `sessions` (+ `board`; + `errorMessage` in Phase 2). **Every** response and `eventBus.publish` goes through it — replaces `stripBoard` whack-a-mole with a type boundary.
- Auth transport: POST bodies `{ token }`; SSE via `?token=` (EventSource can't set headers — query param accepted tradeoff).
- `RoomManager.ts`: `createRoom`/`joinRoom` return `{ playerId, token, ... }`; `startGame/handleGameAction/leaveRoom/reconnect/updatePlayer` take `token`, resolve `playerId = sessions[token]` inside the mutator; `leaveRoom` deletes the session entry; keep the `action.playerId === resolvedPlayerId` check (now meaningful).
- Client (`OnlineGame.tsx`): localStorage key bumped to `trade_tycoon_session_v2` `{roomId, playerId, token}`; old v1 sessions simply fail resume (no compat — rooms are TTL-ephemeral, and any bare-userId compat path reopens the hole).

### 1b. Input validation (H1)
- New `packages/game-logic/src/validate-action.ts`: `parseGameAction(input: unknown): GameAction | null` — hand-rolled per-action validator (keeps game-logic zero-dependency): `Number.isSafeInteger && >= 0 && <= 1e9` for bid amount / trade money / GOOJ card counts; `string[]` for properties; unknown types rejected. Call it in `routes/rooms.ts` actions handler (replacing the line-88 check); 400 on failure.
- Defensive reducer checks in `PLACE_BID` (~`reducer.ts:644`) and `PROPOSE_TRADE` (~`:797`): reject non-integer/negative amounts with `errorMessage`.

### 1c. Name cap (M8)
- `createRoom`/`joinRoom`: `playerName.trim().slice(0, 15)` (mirror `RoomManager.ts:197`).

**Tests:** update `RoomManager.test.ts` + `routes/rooms.test.ts` for token flows; new: `sessions` absent from every response/publish (EventBus spy); acting with another player's id + own token → rejected; bogus token → 401; table-driven `parseGameAction` tests; name truncation.

## Phase 2 — Server/engine correctness (H2, M1, M2, M5, M6, M7 + hardening)

### 2a. Error handling (H2)
- `apps/server/src/middleware/errors.ts`: terminal JSON error middleware; register after routers in `index.ts`. Type `RedisRoomStore.update` CAS exhaustion as `StoreConflictError` → 503 `{ error: 'busy, retry' }`. Drop per-route try/catch (Express 5 forwards async rejections).

### 2b. Deterministic reducer (M1)
- `reduceGameAction(state, action, rng: () => number = Math.random)`; add `mulberry32(seed)` PRNG to game-logic helpers. In `handleGameAction`, generate `seed = crypto.randomInt(2**31)` **outside** `store.update`; inside the mutator call with `mulberry32(seed)` — CAS retries replay identical dice/cards. Replace the 4 `Math.random` sites. Local client play passes nothing (unchanged). Migrate tests to seeded rng; delete `die1/die2` backdoor in Phase 6.
- (Rejected alternative: pre-rolling dice/pre-drawing cards outside the mutator — card draws depend on landing tile, which can change between retries.)

### 2c. Rejected actions + private errors (M5, server half of M9)
- `handleGameAction` returns a discriminated union: same-state/`ACTION_REJECTED`/`errorMessage`-set → `{ ok: false, message }` and abort the update (mutator returns null); success → `{ ok: true, state }`. (Verified: every `errorMessage` path leaves the rest of state unchanged — no reducer rewrite needed.)
- Route: `ok:false` → **409 `{ error }`**, **no publish**; success → publish + 200. Client already renders 409 bodies via `setTransientError` (`OnlineGame.tsx:342-344`) so private errors reach only the actor. Strip `errorMessage` in `toPublicGameState`; keep `toastMessage` (shared announcements). Exclude `DISMISS_ERROR`/`DISMISS_TOAST` from the online action allowlist.
- Adopt the same result union for `startGame/joinRoom/leaveRoom` (removes the "re-get to distinguish 404 vs 409" dance at `rooms.ts:52-55, 68-73`).

### 2d. SSE leak (M6)
- `routes/events.ts`: on write failure call idempotent `cleanup()` (guard boolean), not just warn; also listen on `res.on('close')`.

### 2e. Trade + bankruptcy rules (M2, M7)
- **M2 — forbid, don't transfer** (matches Monopoly rules, less code): `PROPOSE_TRADE` + re-check in `ACCEPT_TRADE` reject any property with `houses[propId] > 0`.
- **M7 — shared cleanup**: refactor `DECLARE_BANKRUPTCY` (`reducer.ts:~1186`) to delegate to the cleanup used by `removePlayerFromGame` (cancel involving trades, fix auction participants, advance turn). Creditor asset transfer = optional gameplay follow-up, not part of this plan.

### 2f. Hardening
- `RESET_GAME` with empty players → `ACTION_REJECTED` (currently crashes at `reducer.ts:206`).
- `generateUserId`/`generateRoomId` (`RoomManager.ts:314-325`) → `crypto` instead of `Math.random`.

**Tests:** seeded-rng determinism (same seed twice → identical state); CAS-retry replays one roll; trade-with-houses rejected; bankruptcy during auction/trade; supertest: invalid action → 409 + no broadcast (EventBus spy); store conflict → 503; SSE write failure unsubscribes.

## Phase 3 — Client correctness (H3, M9-client, M10, M11, M14)

- **H3** (`online-platform.ts`): configured URL wins; in dev keep localhost fallbacks; in prod: web → `''` (same-origin, matches single Vercel deployment), native → `null` + `OnlineGame` renders "server not configured" error.
- **M10**: key the toast auto-dismiss effect on the message value: `useEffect(..., [message])` with cleanup, not on closure identity.
- **M11**: `PropertyManager` binds to the **local** player (`players.find(p => p.id === localPlayerId)`) in multiplayer; managing own assets off-turn is legal.
- **M14**: in-flight `busy` guard (ref) around `handleCreate/handleJoin/handleStartGame/handleGameDispatch`; disable buttons while pending.
- **M9 client half**: stop rendering broadcast `errorMessage` in multiplayer (server no longer sends it); local hotseat play keeps it.

**Tests:** `getOnlineServerUrl` matrix (dev/prod × platform × configured/unset) in existing client vitest.

## Phase 4 — Performance (M3, M4, M12, M13)

- **M3**: `appendLog` helper in game-logic capping `logs` at 200 entries; replace all append sites.
- **M4**: remove `board` from `GameState` entirely (reducer only uses the static `BOARD` constant; online clients already run board-stripped). Grep client for `state.board` and switch hits to importing `BOARD`. Delete board handling from `serialize.ts`.
- **M12**: add `version: number` to `LobbyState`, incremented in `store.update`; native poller skips `setState` when version unchanged and backs off 2s → 5s while idle.
- **M13**: `React.memo` on `Board`/`Tile`/`PlayerToken`; `useCallback`/`useMemo` for GameUI handlers + sharedProps; precompute `Map<tileId, ownerId>` with `useMemo` instead of per-tile `getOwner` scans.

**Tests:** `appendLog` cap; version monotonicity; poll change-detection (after Phase 5 extraction).

## Phase 5 — Tests & CI (H4, M15)

- **H4 — extract for testability**: split `OnlineGame.tsx` into `components/online/api.ts` (typed fetch client), `components/online/session.ts` (v2 storage, injectable), `components/online/useRoomSync.ts` (SSE-vs-polling hook). Test with mocked fetch / fake EventSource / fake timers following the proven `hooks/useStatusPanelActions.test.ts` pure-module pattern (no full RN component-tree rendering). *If the same engineer does Phases 1+5, pull this extraction into Phase 1 to avoid touching the token plumbing twice.*
- **M15 — CI** (`.github/workflows/test.yml`): add `pull_request` trigger; add `npm run lint`; add `type-check` scripts (`tsc --noEmit`) to apps/server and packages/game-logic and run them in CI.

## Phase 6 — Cleanup bundle (all Lows, one PR)

- game-logic: unify `Action`/`GameAction` unions; delete dead fields + `die1/die2` backdoor; enforce doubles bonus roll; house supply limit (gameplay choice — optional).
- server: CORS from `ALLOWED_ORIGINS` env (fallback `*` in dev); collapse double publishes on start/leave (`rooms.ts:75-79, 129-132`).
- client: single toast channel; Pressable backdrop; `value > 0 &&` guards; lazy `useReducer` init; stable log colors; remove `@ts-ignore`; TradeModal functional setState; duplicate-color validation; Android/browser back handling.
- tooling: wire up or delete `lint-staged`; align reanimated 4.5.0 vs 4.4.1 override; slim pre-commit (lint-staged only; CI owns the full suite).

## Dependencies

- Phase 1 server + client are one atomic breaking change (userId → token).
- Phase 2c builds on Phase 1 signatures — land 1 before 2.
- Phase 2b (rng param) must land before Phase 6 deletes `die1/die2`.
- Phase 4 board removal deletes serializer code from Phase 1 (fine in that order).
- Phase 5 extraction after (or merged into) Phase 1 client work.

## Verification (after every phase)

```bash
npm run build:game-logic
npm test --workspace=packages/game-logic   # 147+ tests
npm test --workspace=apps/server           # 87+ tests
npm test --workspace=apps/client
npm run type-check --workspace=apps/client
npx tsc --noEmit -p apps/server            # until Phase 5 adds the script
npm run lint
```

Manual smoke (Phases 1–3): `npm start`, two browser tabs — create/join/start, roll, trade a built-up property (rejected), invalid bid (409 toast only on actor's screen), reload mid-game (v2 session resume), leave. Confirm no `sessions` field in any network payload (DevTools).

## Key files

- [apps/server/src/RoomManager.ts](apps/server/src/RoomManager.ts) — token auth, result union, crypto ids
- [apps/server/src/routes/rooms.ts](apps/server/src/routes/rooms.ts) — validation, 409/no-broadcast, serializer
- [apps/server/src/routes/events.ts](apps/server/src/routes/events.ts) — token auth, leak fix
- [packages/game-logic/src/reducer.ts](packages/game-logic/src/reducer.ts) — rng param, trade/bankruptcy rules, defensive validation
- [packages/game-logic/src/socket-types.ts](packages/game-logic/src/socket-types.ts) — sessions, version
- [apps/client/components/OnlineGame.tsx](apps/client/components/OnlineGame.tsx) — token session v2, guards, extraction
- [.github/workflows/test.yml](.github/workflows/test.yml) — lint + typecheck steps
