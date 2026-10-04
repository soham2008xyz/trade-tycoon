# Implementation plan: disconnected-player recovery (#259)

Spec (approved, committed on `feat/259-disconnected-player-recovery`):
`docs/superpowers/specs/2026-10-05-disconnected-player-recovery-design.md`

## Context

An online player whose client vanishes without calling Leave soft-locks the
game: nobody notices, nothing advances. This change adds presence tracking
(a "disconnected" badge after 45 s unseen) and a manual "remove player" action
so the remaining players can continue. No auto-removal, no skip-turn, and **no
`packages/game-logic` change** — `removePlayerFromGame`
(`packages/game-logic/src/reducer.ts`) already advances the turn and unwinds
auctions/trades.

Order is logic-first and TDD (red → green per task), server before client, so
each task leaves `npm test` green. Commit per task on the feature branch.

**Step 0 (first action once plan mode ends):** copy this plan to
`docs/superpowers/plans/2026-10-05-disconnected-player-recovery.md`, run
`npx prettier --write` + `npm run lint:md`, commit. (Not possible in plan mode.)

## Reuse, don't rebuild

| Need                                         | Existing thing                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Remove a player from lobby + sessions + game | body of `leaveRoom`'s mutator in `apps/server/src/RoomManager.ts` (extract, Task 3)                |
| Token → playerId                             | `RoomManager.resolvePlayerId` (private)                                                            |
| Atomic write + `version` bump                | `RoomManager.bumpedUpdate`                                                                         |
| Failure → HTTP status                        | `STATUS_BY_REASON` / `failWith` in `routes/rooms.ts`                                               |
| Backend selection by `REDIS_URL`             | `buildBackends()` in `apps/server/src/index.ts`                                                    |
| Redis test setup (db 15, `flushdb`)          | `store/RedisRoomStore.test.ts`                                                                     |
| SSE test harness + `parseSSE`                | `routes/events.test.ts`                                                                            |
| Poll change-detection                        | `startRoomSync` in `apps/client/components/online-sync.ts`                                         |
| API helper                                   | `postJson` in `apps/client/components/online-api.ts`                                               |
| Confirm dialog                               | `showAlert` / `CustomAlert` in `GameUI.tsx`                                                        |
| Prop threading to panels                     | `sharedProps` in `GameUI.tsx` → `StatusPanelProps` (`StatusPanel/types.ts`) spread by both layouts |

## Tasks

### 1. `PresenceStore` + disconnect rule (server)

New dir `apps/server/src/presence/`:

- `PresenceStore.ts` — interface `touch(roomId, playerId, now)`,
  `getLastSeen(roomId): Promise<Record<string, number>>`,
  `seedIfAbsent(roomId, playerId, now)` (set only if no record — `HSETNX` on
  Redis), `forget(roomId, playerId)`; plus
  `export const PRESENCE_TIMEOUT_MS = 45_000` and the pure
  `getDisconnectedPlayerIds(playerIds, lastSeen, now): string[]` (stale = strictly
  `now - lastSeen > timeout`; no record = present). Use `Map` for lookups, not
  bracket access on the record (same prototype-key concern as
  `resolvePlayerId`).
- `InMemoryPresenceStore.ts` — nested `Map`.
- `RedisPresenceStore.ts` — hash `presence:<roomId>`; `touch` = `HSET` then
  `EXPIRE` (24 h, same as rooms) sent in one `pipeline()` so a touch is a
  single round trip; `getLastSeen` = `HGETALL`, parse ints; `seedIfAbsent` =
  `HSETNX`; `forget` = `HDEL`. No Lua/CAS needed.
- Tests first: `PresenceStore.test.ts` (rule: stale / fresh / no-record /
  exact boundary / `__proto__` id), `InMemoryPresenceStore.test.ts`,
  `RedisPresenceStore.test.ts` (real Redis db 15, `flushdb` per test).

### 2. Wire presence into `RoomManager` (server)

`RoomManager` constructor becomes
`(store, options: { presence?: PresenceStore; clock?: () => number } = {})`,
defaulting to `InMemoryPresenceStore` and `Date.now`, so the existing
`new RoomManager(new InMemoryRoomStore())` calls in tests don't change.

- Best-effort private `touch(roomId, playerId)` (try/catch → `console.warn`;
  never fails the request). Call it in `createRoom`, `joinRoom`, `reconnect`.
  **Never touch from inside a `bumpedUpdate` mutator** (ADR 0003: mutators are
  synchronous, pure and may be retried). In `handleGameAction` capture the
  resolved `userId` in a closure variable and `touch` _after_ `bumpedUpdate`
  returns, whatever the outcome — a rejected action still proves the player is
  alive. Same rule for any method where the playerId is only known inside the
  mutator.
- Public `recordSeen(roomId, playerId)` for the SSE route.
- Public `getDisconnectedPlayerIds(roomId): Promise<string[]>` — computed over
  the **lobby roster** (`room.players`), not `gameState.players`: bankrupt
  players are dropped from the game roster but keep their lobby entry and
  session, and a bankrupt host who then vanishes must still be flaggable or the
  host-gone fallback never fires. Returns `[]` when no game is running or the
  presence read throws (fail open). Players with no presence record are
  `seedIfAbsent`-ed at `now` (best-effort) so they go stale 45 s later instead
  of being "present" forever (covers games in flight at deploy and Redis
  flushes); they are reported as present for that first call.
- `reconnect` result gains `disconnectedPlayerIds`.
- `index.ts` `buildBackends()` returns a third `presenceStore`
  (Redis when `REDIS_URL`, else in-memory) and passes it to `RoomManager`.
- Tests (`RoomManager.test.ts`, injected fake clock): create/join/reconnect/
  action each touch; stale after 46 s, fresh at 44 s; no game → `[]`;
  presence store throwing doesn't fail `reconnect`; failing read → `[]`;
  `handleGameAction` touches even when the action is rejected, and the touch
  happens outside the mutator; a player with no record is seeded and becomes
  disconnected 46 s later; a bankrupt player (absent from `gameState.players`)
  is still reported when stale.

### 3. Extract shared removal; add `removeDisconnectedPlayer` (server)

- Extract the body of `leaveRoom`'s mutator into private
  `removePlayerFrom(current, userId): LobbyState | null` (sessions filter, host
  reassignment, empty-room reset, finished-game snapshot rule,
  `removePlayerFromGame`). `leaveRoom` calls it — existing `leaveRoom` tests
  must stay green untouched (this is the refactor safety net; run them first).
- `removeDisconnectedPlayer(roomId, token, targetPlayerId)` →
  `RoomResult<{ state; gameState }>`. Capture `disconnected =
await getDisconnectedPlayerIds(roomId)` **before** `bumpedUpdate` (mutator
  stays pure). Mutator checks, in order: token resolves (401) → game running and
  no `winner` (409) → target in room and ≠ caller (409) → target in
  `disconnected` (409 `Player is still connected`) → caller is host, or host
  is in `disconnected` and caller is not (409 `Only the host can remove a
player`) → `removePlayerFrom`. Capture `failure` in a closure variable like
  `startGame` does. Authorization uses the **lobby** roster for the caller (any
  lobby member, incl. a bankrupt one, may remove if they are the host, or are
  connected while the host is disconnected) and the **game** roster for the
  target (must still be in `gameState.players`; a bankrupt player is already out
  of the game and needs no removal). On success `forget` the target's presence (best-effort).
- Tests (RoomManager): each rejection branch writes nothing (version
  unchanged); host removes disconnected non-current player; removing the
  _current_ player advances the turn; host-gone fallback lets a connected
  non-host remove the host and reassigns host; a disconnected non-host caller
  cannot remove anyone; **bankrupt host disconnects, another player vanishes →
  a connected player can still remove them**; a bankrupt (not in game roster)
  target → 409; removed token → `reconnect` is `session_expired`; game
  over → 409; presence unreadable → 409.

### 4. Route + SSE presence event (server)

- `routes/rooms.ts`: `POST /api/rooms/:roomId/remove-player` — `parseNonEmptyString`
  for `token` and `targetPlayerId` (400 if missing), call manager, `failWith`,
  then publish `lobby_update` with `result.state` (carries `gameState`). `/reconnect`
  response adds `disconnectedPlayerIds`.
- `routes/events.ts`: `createEventsRouter` deps gain optional `heartbeatMs`
  (default `15_000`) for testability. After the initial snapshot call
  `recordSeen`, send an initial `presence` event, and on each tick
  (alongside `: ping`) call `recordSeen` and send `presence` only when the set
  differs from the last one sent. Write it as its own
  `event: presence\ndata: {"disconnectedPlayerIds":[…]}` — **not** a `RoomEvent`,
  `EventBus` is untouched. A failed write still goes through `cleanup()`.
- Tests: `rooms.test.ts` — 200 / 400 / 401 / 404 / 409s; bus subscriber sees one
  `lobby_update` on success and **zero** events on failure; `/reconnect`
  includes and refreshes presence. `events.test.ts` — initial `presence`
  frame; with an injected clock and short `heartbeatMs`, a second frame appears
  once the clock passes 45 s and none while unchanged.

### 5. Client API + sync (pure `.ts`)

- `online-api.ts`: `ReconnectResponse` gains `disconnectedPlayerIds: string[]`;
  add `removePlayer(serverUrl, roomId, token, targetPlayerId)` via `postJson`
  (fallback error `'Could not remove player'`). Test in `online-api.test.ts`
  (mocked `fetch`: URL, body, error mapping).
- `online-sync.ts`: add `onPresence: (ids: string[]) => void` to
  `RoomSyncOptions`. SSE: `addEventListener('presence', …)` with the same
  try/catch-parse pattern. Poll: always call `onPresence` when the presence
  set changed, and treat a snapshot as "unchanged" (backoff) only if
  **both** `version` and the presence set match the last one. Update the
  existing option fixtures in `online-sync.test.ts`; add tests for SSE
  presence, poll presence forwarding, and presence-only change not being
  swallowed by the version shortcut.
- `multiplayer-gating.ts`: `canRemovePlayer({ selfId, hostId, targetId,
disconnectedPlayerIds, isMultiplayer })` with full JSDoc (why hotseat has no
  presence). Tests: hotseat false; host + disconnected target true; host +
  connected target false; self-target false; non-host with connected host
  false; non-host connected with disconnected host true; non-host that is
  itself disconnected false. `hostId` comes from `LobbyState.players`
  (`isHost`) — `GameState` has no host.

### 6. Client UI wiring

- `OnlineGame.tsx`: state `disconnectedPlayerIds` fed from `onPresence` and
  from the resume/`reconnectToRoom` response; `handleRemovePlayer(targetId)`
  mirrors `handleGameDispatch` (in-flight guard, `setTransientError` on
  failure); derive `hostId` from `lobbyState.players`. If an `onLobbyState`
  update no longer contains the local `playerId` in **`lobbyState.players`**,
  route it through the existing session-expired path (stop sync,
  `clearStoredSession`, `onBack`) so a removed player isn't left on a dead
  screen. Key this on the lobby roster only — never `gameState.players`, which
  also drops bankrupt players who are still in the room. Put the predicate in a
  pure `.ts` helper (e.g. `wasRemovedFromRoom(lobby, selfId)` in
  `multiplayer-gating.ts`) with tests: removed → true; bankrupt (in lobby, not in
  game) → false; no lobby yet → false.
- `GameUI.tsx`: new optional props `disconnectedPlayerIds`, `hostId`,
  `onRemovePlayer`; add to `sharedProps` + deps; a stable `confirmRemovePlayer(id)`
  using `showAlert` ("Remove Bob? They'll be removed from the game and can't
  rejoin." / Cancel / Remove).
- `StatusPanel/types.ts`: add the same fields to `StatusPanelProps` (layouts
  already spread props to panels).
- `Peek.tsx` / `TabletCenter.tsx`: when the waited-on player is disconnected,
  text becomes "Waiting for Bob… (disconnected)" and, if `canRemovePlayer`, a
  "Remove Bob" `IconButton`. Show it in the `buttons.waiting` branch (and make
  sure it's hidden when `isGameOver`, which `useStatusPanelActions` already
  covers).
- `Expanded.tsx` / `TabletCenter.tsx` roster: a small "disconnected" badge per
  disconnected player, plus a Remove button there when `canRemovePlayer`
  (a non-current disconnected player is also removable). Keep accessibility
  labels like `GOOJBadge`'s.
- Hotseat (`LocalGame`) passes nothing → defaults `[]` / no-op, no UI change.

### 7. Docs + memory (same PR)

- New `docs/adr/0012-presence-lives-outside-the-room-record.md` (separate store,
  side-channel wire shape, no auto-removal; rejected alternatives per spec). Also
  record: (a) **known limitation** — on Vercel the SSE function may not observe
  a closed tab until its ~300 s timeout, and keeps pinging (and touching
  presence) until then, so a vanished _web_ player can look present for up to
  ~5 min; native polling is unaffected; verify on a preview deploy; (b)
  **accepted race** — a target can reconnect between the presence read and the
  store write and be removed while live; the read is deliberately outside the
  mutator (purity), don't "fix" it by moving it in.
- `apps/server/AGENTS.md` layout block (`presence/`, new route, `presence` SSE
  event, `PresenceStore` in `buildBackends`); root `AGENTS.md` §5 route list;
  `docs/ARCHITECTURE.md`; `docs/DEPLOY.md` (new `presence:<roomId>` keys, no
  env var; call out the extra Redis commands per native poll — presence write
  pipeline + `HGETALL` — for Upstash per-command billing); `docs/SPECIFICATION.md` §8 (shipped); `GLOSSARY.md`
  **Disconnected player**; `apps/client/AGENTS.md` sync section (`onPresence`).
- Append durable learnings to `.claude/memory/project.md` and commit it.

## Verification

1. After each task: `npm test --workspace=<ws>`; start Redis locally
   (`redis://127.0.0.1:6379/15`) so `RedisPresenceStore.test.ts` actually runs.
2. Final gate: `npm test`, `npm run lint`, `npm run lint:md`, `npm run format`
   (leave no diff), `npm run build --workspace=apps/server`.
3. Manual two-simulator run (see `reference_ios-testing-setup` memory; iPhone 17
   - second sim, local `npm run server`): start a 2-player online game, kill
     Bob's app on his turn; on Alice's device confirm "Waiting for Bob…" turns to
     "(disconnected)" after ~45 s, the Remove button appears, confirm → Bob's turn
     advances to Alice and play continues; relaunch Bob → Resume gets
     `session_expired`. Repeat on web (close Bob's tab) to exercise the SSE path,
     and with the **host** killed to verify the host-gone fallback.
4. Bankrupt-host scenario: bankrupt the host, kill their app, vanish another
   player, confirm a connected player can still remove them and the bankrupt
   host's own client is **not** bounced to the menu while still connected.
5. Confirm a connected player's Remove attempt (crafted POST) returns 409 and
   publishes nothing.

## Risks / things to watch

- `leaveRoom` extraction is the riskiest edit — run its existing tests before
  and after, change nothing about its behavior.
- Poll change detection must not make native spin at 2 s forever: presence is
  compared as a set, so a stable presence still backs off to 5 s.
- Adding a required `onPresence` to `RoomSyncOptions` breaks existing test
  fixtures; update them in the same task rather than making it optional.
- Lobby vs game roster: presence and removal-caller checks use the lobby
  roster; only the removal _target_ is checked against the game roster.
- `PRESENCE_TIMEOUT_MS` (45 s) is one constant; the open spec assumption.
