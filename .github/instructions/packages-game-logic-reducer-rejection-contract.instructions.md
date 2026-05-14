---
description: Reducer rejection contract for game-logic. Use when editing reduceGameAction, gameReducer, or rejection-path tests.
applyTo: 'packages/game-logic/src/{reducer.ts,reducer.test.ts,auction-trade.test.ts}'
---

# Game Logic Reducer Rejection Contract

Keep the reducer contract stable across client and server usage.

## Contract Layers

- `reduceGameAction` is the detailed reducer API and may return `ACTION_REJECTED` only for the explicit trade-role rejection cases listed below.
- `gameReducer` is the React-safe wrapper and must collapse `ACTION_REJECTED` to unchanged state.
- Do not return `ACTION_REJECTED` from `gameReducer`.

## Allowed Explicit Rejections

Use `ACTION_REJECTED` only for explicit trade-role authorization boundaries:

- `ACCEPT_TRADE` when caller is not `activeTrade.targetPlayerId`
- `CANCEL_TRADE` when caller is not `activeTrade.initiatorId`

Keep other invalid actions as unchanged-state no-ops unless the cross-workspace contract is intentionally updated.

This includes other authorization failures, phase mismatches, and invalid gameplay attempts unless they are one of the two trade-role cases above.

## Stability Rules

- Keep `ACTION_REJECTED` identity stable as a single exported sentinel.
- Preserve `GameReducerResult` as `GameState | ActionRejected`.
- Avoid introducing additional sentinel values.
- Maintain no-throw behavior for invalid action paths.

Rule of thumb: if the caller is not violating one of the two documented trade-role boundaries, prefer unchanged-state behavior over a new rejection sentinel.

## Cross-Workspace Implications

- Server maps detailed reducer rejection to HTTP 409 in action routes.
- Client `useReducer` path must continue receiving `GameState` only.
- If rejection scope changes, update both:
  - `packages/game-logic/AGENTS.md`
  - `apps/server/AGENTS.md`

## Testing Requirements

When rejection behavior changes:

- Add/update tests that assert `reduceGameAction(...) === ACTION_REJECTED` for explicit rejection paths.
- Add/update wrapper tests asserting `gameReducer(...)` returns unchanged input state for the same paths.
- Keep impersonation and role-based rejection cases distinct in tests.
- Verify no accidental `errorMessage` leakage for silent authorization boundaries.

## Verification

- Run `npm test --workspace=packages/game-logic`.

## References

- [packages/game-logic/AGENTS.md](../../packages/game-logic/AGENTS.md)
- [apps/server/AGENTS.md](../../apps/server/AGENTS.md)
- [AGENTS.md](../../AGENTS.md)
