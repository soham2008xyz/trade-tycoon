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
   (e.g. only the host can do X, only the trade target can accept). If
   the action is illegitimate, **return the input state unchanged** — do
   not throw. See "Reducer no-ops" below.

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

## Reducer no-ops on illegitimate actions

The reducer **silently returns the input state** when an action is
illegitimate (non-host START_GAME, non-target ACCEPT_TRADE,
non-initiator CANCEL_TRADE, …). It does **not** throw, and it does not
return a sentinel.

Two consequences to keep in mind:

- **Inside this package**, tests assert state-unchanged via reference
  equality (`expect(newState).toBe(oldState)`) or by inspecting that the
  field the action _would_ have mutated still has its original value.
- **In the server's HTTP layer**, the route returns HTTP 200 with the
  unchanged state — not 409. Tests in `apps/server` that exercise these
  cases assert "trade is still pending after rogue request", not status
  code. The 409 path is reserved for the higher-level
  `userId !== action.playerId` impersonation guard, which is enforced by
  `RoomManager.handleGameAction` _before_ the reducer runs.

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

When the cross-cutting rule changes (e.g., the reducer-no-op behavior is
finally given an explicit error sentinel), update **this file's "Reducer
no-ops" section** AND the matching note in `apps/server/AGENTS.md` —
there are exactly two places that mention this contract.
