# Disconnected-player recovery — design

Issue: [#259](https://github.com/soham2008xyz/trade-tycoon/issues/259) — online
game soft-locks when a player disconnects without leaving.

## Problem

If a player's client disappears mid-game without calling Leave (app killed,
crash, phone locked, closed tab), nothing on the server notices. The status
panel shows "Waiting for Bob…" forever and the only escape for the others is to
leave themselves. There is no presence tracking, no turn timer, and no way to
remove an unresponsive player.

## Goal and non-goals

**Goal.** Show which players are disconnected, and let the room remove a
disconnected player through the same cleanup `/leave` already performs, so the
game can continue.

**Decided with the project owner:** badge + manual removal. No automatic
actions.

**Non-goals.**

- Automatic removal / turn timeout. A locked phone must not cost a player their
  game without a human deciding so.
- A "skip turn" action. Removal is the only recovery.
- Any change to `packages/game-logic`. `removePlayerFromGame` already advances
  the turn when the current player is removed and unwinds auctions and trades
  (`player-removal.test.ts`), so no rule changes. Leaving/removal never
  transfers assets to anyone (ADR 0010).
- Presence in the **lobby** (pre-game). Scope is a started game; the lobby has
  no turn to wait on.
- A heartbeat endpoint or any new client-side heartbeat code (see
  "Heartbeat sources").

## Design

### 1. Presence storage — a new `PresenceStore`

Presence is **not** stored in `LobbyState`.

| Option                         | Verdict                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lastSeen` inside `LobbyState` | Rejected. Native polls every 2–5 s; each poll would CAS-write the whole room JSON, contending with real game actions (CAS retries → 503) and bumping `version` on every tick. |
| Process memory                 | Rejected. Each Vercel request can land on a different instance (ADR 0003).                                                                                                    |
| **Separate `PresenceStore`**   | **Chosen.**                                                                                                                                                                   |

```ts
interface PresenceStore {
  /** Record that `playerId` was seen at `now`. */
  touch(roomId: string, playerId: string, now: number): Promise<void>;
  /** playerId → last-seen epoch ms. Empty for an unknown room. */
  getLastSeen(roomId: string): Promise<Record<string, number>>;
  /** Idempotent; called when a room's state is deleted / a player is removed. */
  forget(roomId: string, playerId: string): Promise<void>;
}
```

- `InMemoryPresenceStore` (tests + dev) and `RedisPresenceStore` (production),
  selected by `REDIS_URL` presence in `buildBackends()` alongside the existing
  two backends. No new env var.
- Redis layout: hash `presence:<roomId>`, field = playerId, value = epoch ms;
  `HSET` then `EXPIRE` with the same 24 h TTL as the room. No CAS: each field
  is single-writer-last-wins, which is exactly the semantics wanted.
- **Clock.** `now` is the server's `Date.now()`, injected into `RoomManager`
  as a `clock` dependency so tests control it. Cross-instance skew (NTP-synced,
  well under a second) is negligible against a 45 s threshold.
- Presence failures must never fail the request they piggyback on: `touch`
  calls from routes are best-effort (caught and logged).

### 2. Heartbeat sources and the disconnect rule

Everything that proves a client is alive already hits the server; each of these
calls `touch` for the token-resolved player:

- `POST /api/rooms` (create) and `/join` — so a fresh player is never flagged.
- `POST /reconnect` — this is the native poll (every 2–5 s) and the web resume.
- `GET /events` on connect, and on each 15 s SSE ping tick while the stream is
  open (web).
- `POST /actions`.

Rule: a player in a running game is **disconnected** when
`now - lastSeen > PRESENCE_TIMEOUT_MS` (45 s, a `RoomManager` constant). A
player with **no** record is treated as present (cold start after a deploy or
Redis flush must not flag the whole table). A locked phone therefore shows as
disconnected after ~45 s and clears itself the moment polling resumes.

45 s is three missed SSE pings and well above the 5 s native poll ceiling.

A pure function `getDisconnectedPlayerIds(players, lastSeen, now)` lives next to
`RoomManager` and is the single definition of the rule.

### 3. Wire shape — presence is a side channel, not state

Staleness is time-based, so no mutation event fires when someone goes stale;
broadcasting it through `LobbyState` would also bump `version` and force a CAS
write. Instead:

- **SSE:** a new event `presence` with data `{ "disconnectedPlayerIds": string[] }`.
  Each open stream emits it on connect (after the snapshot) and on every 15 s
  tick, **only when the set differs from what that stream last sent** (plus the
  initial one), so quiet rooms stay quiet. The cost is one `HGETALL` per stream
  per tick.
- **Poll / reconnect:** `POST /reconnect` responses gain
  `disconnectedPlayerIds: string[]` (empty when no game is running).
- `RoomEvent` in `events/EventBus.ts` is for room mutations published through
  the bus and is **not** extended: presence events are produced by the SSE
  handler itself from the `PresenceStore`, never published, so they cannot be
  replayed or amplified across instances.

`/reconnect` touches presence _and_ reads it, so the polling client sees its own
heartbeat registered in the same round trip.

### 4. Removal route

`POST /api/rooms/:roomId/remove-player` `{ token, targetPlayerId }`.

`RoomManager.removeDisconnectedPlayer(roomId, token, targetPlayerId)` returns a
`RoomResult<{ state: LobbyState; gameState: GameState | null }>` like
`leaveRoom`.

Authorization (all checked inside the store mutator against the current room,
with the presence snapshot captured **before** the update so the mutator stays
a pure function of its input per ADR 0003):

1. Token must resolve to a player → else 401 `unauthorized`.
2. A game must be running and not finished (`gameState` present, no `winner`)
   → else 409.
3. `targetPlayerId` must be a player in the room and must not be the caller
   → else 409.
4. The target must currently be disconnected (same pure function as the wire
   shape) → else 409 `Player is still connected`. This is the safeguard: a live
   player can never be removed.
5. The caller must be the host, **or** any other player who is themselves
   connected when the host is disconnected → else 409
   `Only the host can remove a player`. Without the fallback, a vanished host
   reproduces the soft-lock one level up.

On success the target is removed exactly as `leaveRoom` removes a leaver
(lobby entry, session, game-state removal via `removePlayerFromGame`, host
reassignment if the removed player was the host, empty-room reset). To keep the
two paths from drifting, the body of `leaveRoom`'s mutator is extracted into a
private `removePlayerFrom(current, userId)` that both call.

The route then publishes `lobby_update` (which carries `gameState`) and the
presence entry for the removed player is `forget`-ed. Failures never publish
(AGENTS.md §5, ADR 0004). Status mapping reuses `STATUS_BY_REASON`.

The removed player's session no longer exists, so their next `/reconnect` or
`/leave` gets the existing 404 `session_expired`; the client's resume flow
already discards the stored session on that shape.

### 5. Client

All logic in pure `.ts` modules with node-env vitest tests, per
`apps/client/AGENTS.md`; components only wire.

- `online-api.ts`: `removePlayer(serverUrl, roomId, token, targetPlayerId)`
  following the existing request helpers; the `reconnectToRoom` result type
  gains `disconnectedPlayerIds`.
- `online-sync.ts`: `startRoomSync` gains an `onPresence` callback.
  - SSE: `addEventListener('presence', …)`.
  - Poll: forward `disconnectedPlayerIds` from each snapshot. The
    "unchanged version → skip callbacks" shortcut must **not** swallow a
    presence-only change, so the poll compares the presence set as well as
    `version` before treating a snapshot as unchanged (and keeps the 2 s poll
    floor while presence is changing).
- `OnlineGame.tsx`: holds `disconnectedPlayerIds` in state, passes it down to
  `GameUI`. Also: if a lobby/game update no longer contains the local player
  (they were removed), treat it as session expiry through the existing
  `onSessionExpired` path rather than leaving a dead screen.
- `multiplayer-gating.ts`: `canRemovePlayer({ selfId, hostId, targetId,
disconnectedPlayerIds, isMultiplayer })` — true in multiplayer only when the
  target is disconnected, is not self, and self is the host or (the host is
  disconnected and self is connected). Hotseat: always false (no presence
  there). Tests cover the four standard scenarios from the client guide plus
  the host-gone fallback.
- UI:
  - Status panel (`Peek`, `TabletCenter`): when the player being waited on is
    disconnected, show "Waiting for Bob… (disconnected)" and, if
    `canRemovePlayer`, a **Remove Bob** button gated behind a confirm
    (`CustomAlert`). The button and confirm copy say it removes the player from
    the game and that they cannot rejoin.
  - Player list/roster surfaces that show per-player cards get a small
    "disconnected" badge for any disconnected player (not only the current
    one), because a disconnected non-current player is also removable.
  - A removal rejected with 409 shows the server's message as the existing
    transient toast.

### 6. Docs and memory (same PR)

- ADR `0012-presence-lives-outside-the-room-record.md`: why a separate store,
  why side-channel wire shape, and the "no auto-removal" decision with the
  rejected alternatives.
- `apps/server/AGENTS.md` layout block (new `presence/` dir, new route,
  presence event); `docs/ARCHITECTURE.md`; `docs/SPECIFICATION.md` (feature
  shipped); root `AGENTS.md` §5 wire-contract list (new route).
- `GLOSSARY.md`: **Disconnected player**.
- `docs/DEPLOY.md`: note the new `presence:<roomId>` Redis keys (no new env
  var).
- `.claude/memory/` entries for anything durable learned during implementation,
  committed with the code.

## Error handling summary

| Situation                                                                                                   | Result                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Bad/unknown token on remove                                                                                 | 401                                                                                                                             |
| Room missing                                                                                                | 404                                                                                                                             |
| Not host and host connected / target connected / target self / unknown target / no running game / game over | 409 with message, nothing persisted or broadcast                                                                                |
| `PresenceStore` unavailable                                                                                 | `touch` swallowed and logged; reads fail open (nobody flagged), so a Redis blip can never cause a wrongful removal path to open |
| CAS exhaustion on remove                                                                                    | existing 503 via error middleware                                                                                               |

Reads failing open matters: the remove route re-checks "target is
disconnected" server-side, and if presence cannot be read the route returns 409
rather than assuming the target is gone.

## Testing

Per workspace, TDD:

- **server / presence:** `InMemoryPresenceStore.test.ts`;
  `RedisPresenceStore.test.ts` against real Redis (db 15, `flushdb` per test,
  per `apps/server/AGENTS.md`). `getDisconnectedPlayerIds` unit tests: stale,
  fresh, no-record-is-present, exact-threshold boundary.
- **server / RoomManager:** every authorization branch above (including the
  host-gone fallback and that a _disconnected_ non-host cannot remove anyone),
  removing the current player advances the turn, removing the host reassigns
  host, removed player's token → `session_expired`, no write on any rejection.
- **server / routes:** supertest for 200/401/404/409s, bus subscriber asserts no
  publish on failure and one `lobby_update` on success; `/reconnect` includes
  and updates presence; SSE test (real HTTP, existing parser) for the initial
  `presence` event and a change after the clock advances.
- **client:** `online-sync.test.ts` (SSE `presence` event; poll forwards
  presence; presence-only change is not swallowed by the version shortcut),
  `online-api.test.ts` (`removePlayer`), `multiplayer-gating.test.ts`
  (`canRemovePlayer`).
- **game-logic:** none added (no rule change). If implementation reveals
  `removePlayerFromGame` misbehaves for this entry path, that is a game-logic
  bug fixed with a vitest case there.
- Manual: two simulators (per the iOS testing memory) — kill Bob's app, confirm
  the badge after ~45 s and that Alice can remove him and the game continues.

## Open assumptions

- 45 s `PRESENCE_TIMEOUT_MS` is a starting value; it is a single constant.
- Presence refresh on web depends on the SSE stream being open; a backgrounded
  web tab keeps its SSE connection, so it stays "present" — acceptable, and
  consistent with the server's view of a live connection.

## As built — deviations from the design above

Review of the plan and the implementation changed these points; the ADR
(`docs/adr/0012-presence-lives-outside-the-room-record.md`) is the current
statement of the decisions.

- **`PresenceStore.getLastSeen` returns a `ReadonlyMap`, not a `Record`**, and
  the interface gained `seedIfAbsent`. A plain object silently drops a
  `__proto__` key; a `Map` has no such hazard.
- **"No record means present" is not permanent.** The presence read seeds a
  missing record at "now", so a player who vanished before their first
  heartbeat (or during a deploy/Redis flush) goes stale 45 s later instead of
  never.
- **Disconnection is computed over the lobby roster**, not the game roster.
  Bankrupt players leave `gameState.players` but keep their lobby entry; keying
  on the game roster would hide a bankrupt host who then vanishes and defeat the
  host-gone fallback. The removal _target_ is still checked against the game
  roster. The client's "was I removed" check likewise uses the lobby roster so
  bankrupt players are not bounced to the menu.
- **Presence is touched after the store update, never inside the mutator**
  (ADR 0003), and `handleGameAction` touches even when the action is rejected.
- **Caller authorization (rule 5) no longer requires the caller to be
  "connected".** A removal request is an authenticated request and is counted as
  a heartbeat before presence is read, so "caller is alive" is true by
  construction. The rule is: the caller is the host, or the host is
  disconnected.
- **The Redis touch is one pipelined round trip** (`HSET` + `EXPIRE`), to limit
  per-command cost on every native poll.
- **Known limitation recorded in the ADR:** on Vercel a vanished _web_ player
  can look present until the SSE function times out (~5 min); native polling is
  unaffected.
