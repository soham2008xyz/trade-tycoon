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
   `src/reducer.ts` (the union near the top of the file). Include
   `playerId: string` if the action is player-scoped — the server-side
   `userId === action.playerId` check relies on this field.

2. **Reducer case.** Add a `case '<TYPE>':` to `gameReducer` that returns
   a new state. Validate any role-specific invariants in the case body
   (e.g. only the host can do X, only the trade target can accept). Most
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

- **Deterministic dice.** `vi.spyOn(Math, 'random').mockReturnValue(0)`
  before the action, `mockRestore()` after. Without this, ROLL_DICE tests
  are flaky.
- **Assert on returned state, not on mutation.** The reducer is
  immutable; the original state object should not change. If a test
  passes only because of mutation, it's wrong.
- **Cover the rejection path.** For every "only X can do Y" rule,
  include a test where someone _else_ tries Y and verify the state is
  unchanged (`expect(newState).toBe(oldState)` works because the reducer
  returns the input identity-equal when it no-ops).

## Reducer rejections on trade authorization failures

Most illegitimate actions still **silently return the input state**.
That remains the default rule for things like non-host START_GAME.

Trade authorization has a stricter path:

- `reduceGameAction(...)` may return the `ACTION_REJECTED` sentinel for
  `ACCEPT_TRADE` from a non-target or `CANCEL_TRADE` from a
  non-initiator.
- `gameReducer(...)` is intentionally kept React-compatible for
  `useReducer`; it collapses that sentinel back to the original state.

Two consequences to keep in mind:

- **Inside this package**, tests for the client-facing wrapper still
  assert state-unchanged via reference equality, while tests that need
  the explicit server contract assert `reduceGameAction(...) ===
ACTION_REJECTED`.
- **In the server's HTTP layer**, those rogue trade actions now produce
  HTTP 409, while the higher-level `userId !== action.playerId`
  impersonation guard still rejects earlier in
  `RoomManager.handleGameAction`.

## Where things live

```text
src/
  types.ts                    GameState, Player, Tile, action types
  reducer.ts                  gameReducer + Action union
  helpers.ts                  Pure helpers used by the reducer
  game-setup.ts               createInitialState, createPlayer
  board-data.ts               BOARD constant — every tile, in order
  cards.ts                    Chance + Community Chest deck logic
  chance-cards.ts             Chance card content
  community-chest-cards.ts    Community Chest card content
  socket-types.ts             LobbyPlayer, LobbyState (legacy filename;
                              the file no longer contains Socket.IO
                              types — those went away with the migration)
```

When the cross-cutting rule changes, update **this file's "Reducer
rejections" section** AND the matching note in `apps/server/AGENTS.md`
— there are exactly two places that mention this contract in detail.
