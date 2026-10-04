# Players authenticate with a private session token, and resume is opt-in

Creating or joining a room returns a public `playerId`, which is safe to broadcast, and a private session `token`, which is the actual credential and is never rendered, logged or broadcast. Every endpoint resolves the token to a `playerId` and checks it against the action before the reducer runs.

## Considered options

- **The public `playerId` as the credential (the original design, removed).** Every client received every player's id in each state update, so any player could act as any other: spend their money, accept their trades, or hijack their session through reconnect. This was the audit's one critical finding.

## Decisions

- **The token-to-player map lives in the room's lobby state, inside `game-logic`**, rather than in a separate store or in the server workspace. It then shares the room's compare-and-swap atomicity and expiry as one record. It is server-internal: every response and broadcast strips it through `toPublicLobbyState`. This is a deliberate exception to "`game-logic` holds only rules".
- **Old sessions are not migrated.** The stored session key was bumped to `v2` and the pre-token format is dropped. Those sessions carried only a public id, so there is nothing safe to resume from, and any compatibility path for a bare id would reopen the hole.
- **Resume is opt-in.** Only the "Resume Game" button reads the stored session. The first implementation resumed automatically on every mount, and a second browser tab sharing `localStorage` was routed into the host's lobby as the host. Do not add auto-resume on Create or Join.
- **An unknown token is `401` on `/actions` and `/events`, but `/reconnect` and `/leave` report `404 session_expired` for both a stale token and a missing room.** The client's resume flow branches on that exact shape to decide whether to discard its stored session. This is deliberate, not an inconsistency to "fix" towards 401.
