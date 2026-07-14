# `apps/client` — Agent Notes

This file complements the **root `AGENTS.md`**. Read that first for the
project map, cross-cutting architecture invariants, and the "one fact,
one home" rule. This file covers only what's specific to the client
workspace.

> **Memory reminder:** when you discover a new insight, gotcha, or
> convention while working in this workspace, add it to the relevant
> `.claude/memory/` file **and commit that file** alongside your code
> changes. See the root `AGENTS.md` intro for details.

## Layout

```text
app/
  _layout.tsx                 expo-router root (Stack)
  index.tsx                   Top-level screen state machine
components/
  *.tsx                       UI components (React Native)
  multiplayer-gating.ts       Pure visibility predicates (NO React)
  multiplayer-gating.test.ts  vitest tests for the predicates
  ui/                         Primitives (IconButton, Toast, …)
hooks/                        Custom hooks
constants/                    Color tables and the like
scripts/                      Build-time PWA / asset generation
```

## File-extension discipline

- **`.tsx`** for components: imports React Native, uses JSX.
- **`.ts`** for pure helpers and gating predicates: must NOT import
  anything from `react`, `react-native`, `expo-*`, or `@expo/*`. The
  vitest setup runs in plain Node — pulling in any of those breaks the
  test environment.

The canonical example is `components/multiplayer-gating.ts` (pure
helpers, tested in node) vs `components/AuctionModal.tsx` (component,
re-exports the helpers for ergonomic imports). Tests import directly
from the `.ts` module, **never** from a `.tsx` file.

## Multiplayer-gating discipline

Every "is this UI element visible to the local user" rule lives in
`components/multiplayer-gating.ts` as a pure predicate, paired with a
unit test in `components/multiplayer-gating.test.ts`. Components import
the predicate; **they do not re-implement the rule.**

When you add a new multi-player UI surface that needs different
visibility in hotseat vs online:

1. Add an exported function to `multiplayer-gating.ts` with full-
   sentence JSDoc explaining the rule and why hotseat and online
   diverge.
2. Add unit tests covering the four standard scenarios: hotseat
   (always visible), multiplayer-as-actor (visible), multiplayer-as-
   other (hidden), missing-id (hidden in multiplayer / visible in
   hotseat).
3. Use the predicate from the component. Pass it whatever data it
   needs (`selfId`, `isMultiplayer`, the relevant slice of state).

This is the only client-side test surface today. Vitest, node env, no
React Testing Library, no jsdom.

## Two patterns for hotseat-vs-online

The client needs different behaviour in **local hotseat play** (one
device, the user passes it between players) and **online multiplayer**
(one browser per user). Two patterns handle this:

### Pattern 1: implicit via `isMyTurn`

For UI tied to **the outer-game active player** (Roll Dice, Buy, End
Turn, Pay Fine, Manage Properties, Bankruptcy):

```ts
const isMyTurn = state.currentPlayerId === myPlayerId;
```

Works in both modes because of how `myPlayerId` is wired upstream:

- `LocalGame` passes `currentPlayerId={state.currentPlayerId}` —
  `isMyTurn` is always `true` during play (the user-at-the-device IS
  the active player).
- `OnlineGame` passes `currentPlayerId={playerId || ''}` — the local
  user's public id (resolved from the session at join/create time),
  not the private `token`. `isMyTurn` is true only on the active
  player's client.

This is the unifying trick. It works as long as the rule maps cleanly
to "is the active outer-game player".

### Pattern 2: explicit via `isMultiplayer`

For UI **not** tied to the outer-game active player:

- **Auction bid/fold**: bidders rotate among auction participants;
  the active outer-game player isn't involved.
- **Trade Accept/Reject/Cancel**: the trade's initiator and target
  may not be the active player.

For these, `isMyTurn` is the wrong question. `OnlineGame` passes
`isMultiplayer={true}` to `GameUI`, which threads it (along with
`myPlayerId`) through `Board` to the modals. The gating predicates
in `multiplayer-gating.ts` then express the rule
(`!isMultiplayer || playerId === myPlayerId`).

When you add a new modal or interactive surface, the question is:
_does this control apply to the outer-game active player?_ If yes,
use Pattern 1. If no, use Pattern 2.

## Room sync (SSE + native polling)

Online state arrives via `GET /api/rooms/:id/events?token=...` on web
(SSE) or a version-aware poll on native (no `EventSource`). The
transport logic lives in `components/online-sync.ts`
(`startRoomSync`), a framework-free module unit-tested in the node
environment — `OnlineGame.tsx` only wires its callbacks onto React
state in a `useEffect` keyed on `[roomId, token]`.

- SSE: `addEventListener('lobby_update', ...)` /
  `addEventListener('game_state_update', ...)`, not the generic
  `onmessage`. The browser's `EventSource` **auto-reconnects** on its
  own when the connection drops (e.g. Vercel's 300s timeout) — don't
  hand-roll reconnect logic.
- Native poll: backs off from 2s to 5s while the server's
  `lobby.version` is unchanged, resets to 2s on a real change, and
  stops on a 404 (`onSessionExpired`).
- `startRoomSync` returns a `{ stop() }` handle; `OnlineGame` keeps it
  in a ref and calls `stop()` both on effect cleanup and in
  `handleLeave` (before the `/api/rooms/:id/leave` POST, so the
  route's own broadcast can't resurrect state being abandoned).

Adding a new sync case (a new event type, a new poll response field)
belongs in `online-sync.ts` and its `online-sync.test.ts`, not inline
in the component.

## Resume is opt-in (not auto)

`OnlineGame` mounts in one of three modes via `initialMode`:
`'create'`, `'join'`, or `'resume'`. Only `'resume'` reads
`localStorage` and calls `POST /api/rooms/:id/reconnect`; the
multiplayer menu surfaces a "Resume Game" button when a session is
stored under key `trade_tycoon_session_v2` (shape:
`{ roomId, playerId, token }`, read/written via `online-session.ts`),
and that's the only entry point. `online-session.ts` is a `.ts`
module — it takes `Platform.OS` as an injected parameter rather than
importing `Platform` itself; see "File-extension discipline" above.

**Do not add silent auto-restore on Create/Join intent.** That was
the impersonation bug — a 2nd browser tab with shared localStorage
got routed straight into the host's lobby AS the host. The current
opt-in design is what's correct; the test in
`apps/server/src/routes/rooms.test.ts` covers the
`session_expired` path that backstops the client.

## Platform guards

- `localStorage` is **web-only**. Always wrap reads/writes in
  `if (Platform.OS === 'web') { ... }`. Native has no equivalent in
  the current code; the resume affordance simply doesn't appear on
  native.
- `EventSource` is web-only. `OnlineGame.tsx` guards on
  `typeof EventSource === 'undefined'` before subscribing. Native
  multiplayer uses a reconnect-polling fallback instead, via
  `components/online-platform.ts`, so lobby/game state still refreshes
  on iOS and Android without a browser SSE implementation.

## Test command

```sh
npm test --workspace=apps/client
```

Runs vitest against `components/**/*.test.ts(x)` in node env. There
are no jsdom or RTL setups; if you need to test something that
requires either, lift the logic into a pure module first (see
`multiplayer-gating.ts`) and test that.
