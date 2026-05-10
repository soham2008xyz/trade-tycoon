# `apps/client` — Agent Notes

This file complements the **root `AGENTS.md`**. Read that first for the
project map, cross-cutting architecture invariants, and the "one fact,
one home" rule. This file covers only what's specific to the client
workspace.

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
- `OnlineGame` passes `currentPlayerId={userId || ''}` — `isMyTurn` is
  true only on the active player's client.

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
*does this control apply to the outer-game active player?* If yes,
use Pattern 1. If no, use Pattern 2.

## EventSource wiring

Online state arrives via `GET /api/rooms/:id/events?userId=...`
(SSE). The implementation in `OnlineGame.tsx` is the template:

- Subscribe in a `useEffect` keyed on `[roomId, userId]` — only when
  both are set (i.e., we've joined a room).
- Use `addEventListener('lobby_update', ...)` and
  `addEventListener('game_state_update', ...)` for typed events.
  Don't use the generic `onmessage`.
- The browser's `EventSource` **auto-reconnects** when the connection
  drops (e.g., when Vercel's 300s timeout closes the stream). Don't
  hand-roll reconnect logic.
- Clean up in the effect's return: `removeEventListener` + `es.close()`.
  Also `eventSourceRef.current?.close()` in `handleLeave` so a manual
  exit terminates the stream immediately.

## Resume is opt-in (not auto)

`OnlineGame` mounts in one of three modes via `initialMode`:
`'create'`, `'join'`, or `'resume'`. Only `'resume'` reads
`localStorage` and calls `POST /api/rooms/:id/reconnect`; the
multiplayer menu surfaces a "Resume Game" button when
`localStorage.trade_tycoon_session` is set, and that's the only
entry point.

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
  multiplayer doesn't currently have an SSE alternative wired in.

## Test command

```sh
npm test --workspace=apps/client
```

Runs vitest against `components/**/*.test.ts(x)` in node env. There
are no jsdom or RTL setups; if you need to test something that
requires either, lift the logic into a pure module first (see
`multiplayer-gating.ts`) and test that.
