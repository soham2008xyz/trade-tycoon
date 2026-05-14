---
description: Rules for client multiplayer gating in hotseat vs online modes. Use when editing OnlineGame, LocalGame, GameUI, Board, AuctionModal, TradeModal, or multiplayer-gating helpers/tests.
applyTo: 'apps/client/components/{multiplayer-gating.ts,multiplayer-gating.test.ts,GameUI.tsx,Board.tsx,AuctionModal.tsx,TradeModal.tsx,LocalGame.tsx,OnlineGame.tsx,MultiplayerMenuScreen.tsx}'
---

# Client Multiplayer Gating Rules

Keep multiplayer visibility and identity rules centralized and testable.

## Source Of Truth

- Put role/visibility predicates in `apps/client/components/multiplayer-gating.ts`.
- Keep `multiplayer-gating.ts` pure TypeScript: no imports from React, React Native, Expo, or platform APIs.
- Components must call shared predicates. Do not duplicate gating logic inline in JSX.

## Hotseat vs Online Patterns

- Use implicit turn-gating (`isMyTurn`) only for controls tied to the outer game turn.
- Use explicit multiplayer gating (`isMultiplayer` plus player identity) for role-based surfaces like auction and trade controls.
- In hotseat (`isMultiplayer === false`), controls remain visible for the user holding the device.
- In online mode (`isMultiplayer === true`), only the local user role should see actionable controls.

## Testing Requirements

When gating behavior changes:

- Update `apps/client/components/multiplayer-gating.test.ts`.
- Cover these scenarios for each predicate:
  - hotseat visibility
  - multiplayer as actor
  - multiplayer as non-actor
  - missing identity safety case
- Keep parity tests that document hotseat and online behavior side by side.

## Session and Platform Constraints

- Resume must remain opt-in via the multiplayer menu. Do not add silent auto-resume on create/join paths.
- Guard web-only APIs (`localStorage`, `EventSource`) and preserve native fallback behavior.

## Verification

- Run `npm test --workspace=apps/client` after gating changes.

## References

- [apps/client/AGENTS.md](../../apps/client/AGENTS.md)
- [AGENTS.md](../../AGENTS.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
