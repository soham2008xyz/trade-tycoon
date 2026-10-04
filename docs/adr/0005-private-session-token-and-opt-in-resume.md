# Players authenticate with a private session token, and resume is opt-in

Creating or joining a room returns a public `playerId`, which is safe to broadcast, and a private session `token`, which is the actual credential and is never rendered, logged or broadcast. Every endpoint resolves the token to a `playerId` and checks it against the action before the reducer runs. The token-to-player map lives inside the room's lobby state in `game-logic`, rather than in a separate store, so it shares the room's compare-and-swap atomicity and expiry; every response and broadcast strips it through `toPublicLobbyState`.

Resuming a stored session is deliberately opt-in: only the "Resume Game" button reads the stored session. Restoring it silently on Create or Join caused a bug where a second browser tab sharing `localStorage` was routed into the host's lobby as the host, so don't add auto-resume.
