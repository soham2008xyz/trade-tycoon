---
description: Server action authorization boundaries for rooms/actions routes. Use when editing RoomManager, rooms routes, or multiplayer action tests.
applyTo: 'apps/server/src/{RoomManager.ts,routes/rooms.ts,routes/rooms.test.ts}'
---

# Server Action Auth Boundaries

Preserve server-side authorization checks even when client UI already hides invalid actions.

## Core Boundary Rules

- Treat every client action payload as untrusted input.
- Enforce action ownership: if an action carries `playerId`, it must match authenticated `userId`.
- Reject client-issued `RESET_GAME` on the action route path (enforced in `RoomManager.handleGameAction`).
- Ignore client-supplied dice values on `ROLL_DICE`; server RNG remains authoritative.
- Keep explicit reducer rejection handling (`ACTION_REJECTED`) mapped to route-level `409 Action rejected`.

## Route Contract For POST /api/rooms/:roomId/actions

- `404` when room does not exist.
- `409` when game has not started.
- `403` only when authenticated user is not part of the running game.
- `409` when `handleGameAction` rejects the action (ownership, trade-role, reducer rejection).
- `200` only when action is accepted and published.

## Trade Role Enforcement

Keep server enforcement in place even if client gating is correct:

- Only trade target may `ACCEPT_TRADE`.
- Only trade initiator may `CANCEL_TRADE`.
- Third-party or wrong-role trade actions must return `409` and leave pending trade unchanged.

## Testing Requirements

When auth boundaries change:

- Update `apps/server/src/routes/rooms.test.ts` and/or `apps/server/src/RoomManager.test.ts`.
- Cover both acceptance and rejection paths.
- Assert both HTTP status and state invariants (for example, trade remains pending after rejected action).
- Keep impersonation tests (`userId !== action.playerId`) distinct from role-based trade rejection tests.

## Implementation Guardrails

- Keep authorization checks in `RoomManager.handleGameAction`.
- Keep route handlers as HTTP adapters; do not duplicate business logic in routes.
- Preserve board stripping before returning/publishing game state snapshots.

## Verification

- Run `npm test --workspace=apps/server` after boundary changes.

## References

- [apps/server/AGENTS.md](../../apps/server/AGENTS.md)
- [AGENTS.md](../../AGENTS.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
