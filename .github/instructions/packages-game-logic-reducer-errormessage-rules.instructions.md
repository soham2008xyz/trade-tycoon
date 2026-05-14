---
description: Reducer errorMessage rules for game-logic actions. Use when editing reducer behavior or reducer tests.
applyTo: 'packages/game-logic/src/{reducer.ts,reducer.test.ts,auction-trade.test.ts}'
---

# Game Logic Reducer errorMessage Rules

Keep user-facing failures explicit, but keep authorization failures silent.

## When To Set errorMessage

Set `errorMessage` when the local player needs actionable feedback, such as:

- invalid phase for a player-initiated operation
- insufficient funds or unmet economic preconditions
- invalid property/tile preconditions for buy/build/sell/mortgage actions
- other user-correctable rule violations where a toast/banner helps recovery

Use short, clear strings that explain what the player can infer from the failure.

## When To Keep A Silent No-op

Do not set `errorMessage` for authorization or identity boundaries. Return unchanged state for:

- wrong player attempting the action (`currentPlayerId` mismatch)
- phase/turn ownership boundaries that are enforcement-only
- non-host/non-target/non-initiator role violations in client-facing reducer behavior

For these paths, preserve reference-equality no-op behavior (`return state`) where applicable.

## Trade Authorization Contract

- `reduceGameAction` may return `ACTION_REJECTED` for unauthorized trade accept/cancel paths.
- `gameReducer` must keep React compatibility by collapsing `ACTION_REJECTED` to unchanged state.
- Do not surface these auth failures via `errorMessage` in the client-facing reducer wrapper.

## Clearing Behavior

- Clear stale errors (`errorMessage: undefined`) after successful state transitions that should unblock UI.
- Keep `DISMISS_ERROR` behavior intact as the explicit clear path.
- Avoid carrying obsolete `errorMessage` across unrelated successful actions.

## Testing Requirements

When error behavior changes:

- Update `packages/game-logic/src/reducer.test.ts` (and related tests when needed).
- Test both success and failure paths.
- Assert message content for user-facing failures.
- Assert unchanged-state identity for silent no-op authorization paths.
- For trade auth boundaries, assert `ACTION_REJECTED` in detailed reducer tests and unchanged state in `gameReducer` tests.

## Verification

- Run `npm test --workspace=packages/game-logic` after reducer error behavior changes.

## References

- [packages/game-logic/AGENTS.md](../../packages/game-logic/AGENTS.md)
- [AGENTS.md](../../AGENTS.md)
- [apps/server/AGENTS.md](../../apps/server/AGENTS.md)
