# `packages/game-logic` — Agent Notes

This file complements the **root `AGENTS.md`**. Read that first for the
project map, cross-cutting workflows, and the "one fact, one home" rule.
This file covers only what's specific to the game-logic workspace.

> **Memory reminder:** when you discover a new insight, gotcha, or
> convention while working in this workspace, add it to the relevant
> `.claude/memory/` file **and commit that file** alongside your code
> changes. See the root `AGENTS.md` intro for details.

## Purpose

Pure-TypeScript reducer + types that encode every game rule. Imported by
both `apps/client` (offline play and online action dispatch) and
`apps/server` (the authoritative reducer for online games).

The package also hosts transport-agnostic multiplayer state that both
sides must agree on: `LobbyState` (in `socket-types.ts`) carries the
room's `sessions` map (private token → public playerId) and `version`
counter. Sessions are auth data, not a game rule — they live here
deliberately so they ride the store's CAS atomicity and room TTL as one
record. They are server-internal: every response/broadcast passes
through `toPublicLobbyState` (apps/server/src/serialize.ts) to strip
them.

## The "no platform imports" invariant

Nothing in `src/` may import from React, React Native, Node-specific APIs
(`fs`, `path`, …), or browser globals (`window`, `localStorage`, …). The
package must run in three hosts: vitest (Node), the Express server (Node),
and React Native (RN runtime + web). If you find yourself reaching for a
platform-specific API, the rule is wrong somewhere upstream — either the
caller should pass the value in, or the rule belongs in the caller.

## How a new game action is added

A new action is **always** three coordinated changes; missing any one
breaks compilation or correctness.

1. **Type.** Add a variant to the `Action` discriminated union in
   `src/reducer-types.ts` (the union at the top of the file). Include
   `playerId: string` if the action is player-scoped — the server
   resolves the caller's session token to a playerId and checks it
   against this field. Client-sent actions must also get a case in
   `src/validate-action.ts` (`parseGameAction`), the network boundary
   validator — an action without a case there can never arrive online.

2. **Reducer case.** Add a `case '<TYPE>':` to the `reduce…Action` switch
   of the handler module that owns the rule (`turn-actions.ts`,
   `property-actions.ts`, `auction-actions.ts` or `trade-actions.ts`; see
   "Where things live") and put the rule in a small named function that
   it calls. Keep each switch to the actions of its own module:
   `reducer.ts` only tries the four modules in turn, so a new module is
   one more link in that chain. Validate any role-specific invariants in
   the handler (e.g. only the host can do X, only the trade target can
   accept). Most
   illegitimate actions should still return the input state unchanged —
   do not throw. The trade-auth exceptions are documented in
   "Reducer rejections" below.

3. **Test.** Add a `*.test.ts` next to the reducer file (or in the
   relevant existing test file: `reducer.test.ts`,
   `auction-trade.test.ts`, `cards.test.ts`, etc.) that covers the new
   case. Use the patterns described below.

## Test idioms

vitest, run with `npm test --workspace=packages/game-logic`. Tests live
alongside the source: `cards.ts` ↔ `cards.test.ts`.

- **Deterministic dice.** Pass a seeded rng as the third argument:
  `reduceGameAction(state, action, mulberry32(42))`. The reducer only
  falls back to `Math.random` when no rng is supplied (local hotseat
  play). Without a seed, ROLL_DICE tests are flaky.
- **Assert on returned state, not on mutation.** The reducer is
  immutable; the original state object should not change. If a test
  passes only because of mutation, it's wrong.
- **Cover the rejection path.** For every "only X can do Y" rule,
  include a test where someone _else_ tries Y and verify the state is
  unchanged (`expect(newState).toBe(oldState)` works because the reducer
  returns the input identity-equal when it no-ops).

## Reducer rejections

A rejected action surfaces one of three ways:

- The `ACTION_REJECTED` sentinel from `reduceGameAction(...)` — hard
  rejections such as `ACCEPT_TRADE` from a non-target or `CANCEL_TRADE`
  from a non-initiator. `gameReducer(...)` is intentionally kept
  React-compatible for `useReducer`; it collapses the sentinel back to
  the original state.
- The **input state returned unchanged** (reference-equal) — pure
  no-ops like acting out of turn. Still the default for things like
  non-host START_GAME.
- A **soft rejection**: same state plus `errorMessage` set — rule
  failures the player needs feedback on (e.g. "can't afford it").

Consequences to keep in mind:

- **Inside this package**, tests for the client-facing wrapper still
  assert state-unchanged via reference equality, while tests that need
  the explicit server contract assert `reduceGameAction(...) ===
ACTION_REJECTED`.
- **In the server's HTTP layer**, all three shapes are treated
  identically: the store update is aborted (nothing persisted, nothing
  broadcast) and the route returns HTTP 409 carrying the rejection
  message to the acting player only. The token-resolved
  `playerId !== action.playerId` impersonation guard still rejects
  earlier in `RoomManager.handleGameAction`, and an invalid token is a
  separate 401.

## Jail cards

Each deck has exactly one Get Out of Jail Free card, so a held one must not
be drawn again. `Player.getOutOfJailCards` stays the per-player **count**
(trades, the "Use Card" button); `GameState.jailCardHolders` records which
**deck** each counted card came from. Two rules keep them in step:

- Never read `jailCardHolders` raw. Go through `resolveJailCardHolders`: the
  count is authoritative, and it rebuilds holders for rooms saved before the
  field existed and for fixtures that just set a count.
- Any code that moves a counted card between players (trades, bankruptcy,
  leaving) must move the matching deck's holder too — use `swapJailCards` /
  `moveJailCards`. Drawing excludes a held jail card from the pool but still
  makes exactly **one** rng call, so server-side tests that script rng
  sequences stay valid.

## Turn timers

`turn-timer.ts` holds the pure pieces of the online turn/bid clocks (design in
[ADR 0013](../../docs/adr/0013-turn-deadlines-are-stamped-by-the-server-and-enforced-lazily.md)).
The reducer never reads a clock; rules that bite:

- Only the **server** stamps and expires: `stampTurnTimer(state, now)` after an
  accepted reducer step, `expireTurnTimer(state, now, rng)` when due. Both take
  `now`, so tests pass numbers and never fake timers. Hotseat calls neither.
- Stamp **after** the "unchanged reference means rejected" checks:
  `stampTurnTimer` returns the same reference only when nothing needed
  re-arming, and a rejected action must not be stamped into a "change".
- The re-arm key (`getTimerSubject`) is what makes "no free extension" true. A
  new reducer path that changes whose turn it is, or who is bidding, needs no
  timer code as long as the key still changes; one that should _not_ reset the
  clock must leave the key alone.
- Expiry reuses real reducer paths (`forceEndTurn` → END_TURN,
  `passAuctionBidder` → CONCEDE_AUCTION) so logs, auctions and the debt rule
  stay in one place. `timer.remainingMs` (wire) and `timer.expiresAt` (client)
  are never stored; `deadline` is the only authoritative field.

## Where things live

```text
src/
  types.ts                    GameState, Player, Tile, action types
  reducer.ts                  gameReducer / reduceGameAction entry points: routes an
                              action to the module below, then settles debts and
                              caps the log; also removePlayerFromGame, forceEndTurn
  reducer-types.ts            Action union, ACTION_REJECTED, GameReducerResult, Rng
                              (re-exported by reducer.ts; handler modules import
                              from here so they never import reducer.ts back)
  turn-actions.ts             Handlers: lobby/reset, jail, END_TURN, bankruptcy; passTurn
  roll-dice.ts                ROLL_DICE as a pipeline of steps over a draft
                              (move, cards, jail tile, tax, rent)
  property-actions.ts         Handlers: buy, decline, build, sell, (un)mortgage
  auction-actions.ts          Handlers: bid, concede; startAuction
  trade-actions.ts            Handlers: propose, accept, reject, cancel
  player-removal.ts           Shared cleanup for a leaver or bankrupt player
  debt.ts                     chargePlayer / settleDebt / clearSettledDebts
  player-update.ts            replacePlayerAt (immutable player-list update)
  helpers.ts                  Pure helpers used by the reducer
  game-setup.ts               createInitialState, createPlayer
  player-colors.ts            Color palette + uniqueness rule (client setup,
                              server lobby, RESET_GAME all share it)
  board-data.ts               BOARD constant — every tile, in order
  cards.ts                    Chance + Community Chest deck logic
  turn-timer.ts               Online turn/bid deadlines: stamp, expire, localize
                              (see "Turn timers" below)
  jail-cards.ts               Which deck each held Get Out of Jail Free card
                              belongs to (see "Jail cards" below)
  chance-cards.ts             Chance card content
  community-chest-cards.ts    Community Chest card content
  socket-types.ts             LobbyPlayer, LobbyState (legacy filename;
                              the file no longer contains Socket.IO
                              types — those went away with the migration)
```

When the cross-cutting rule changes, update **this file's "Reducer
rejections" section** AND the matching note in `apps/server/AGENTS.md`
— there are exactly two places that mention this contract in detail.
