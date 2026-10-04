# Online play uses REST plus Server-Sent Events, not WebSockets

The server is deployed as Vercel serverless functions, which do not terminate WebSocket connections (upgrades return HTTP 400). Client-to-server traffic is therefore REST under `/api/rooms/*` and server-to-client push is a Server-Sent Events stream, with a version-aware poll as the fallback where `EventSource` does not exist.

## Considered options

- **Socket.IO (tried, then removed).** It was the original transport. Because Vercel cannot hold WebSockets, it silently fell back to long-polling, and each polling round trip could land on a different ephemeral function instance that did not share the engine.io session map. Joining a lobby therefore failed intermittently in production, depending on how requests happened to fan out. Swapping to REST plus SSE removed the dependency from both client and server.

## Consequences

- Native clients have no `EventSource`, so they poll the same room snapshot instead. A `version` counter on the room, bumped on every successful write, lets the poller tell "nothing changed" from "new state": it skips redundant re-renders and backs off while idle.
- The browser's `EventSource` reconnects on its own when Vercel closes a stream at its function timeout, so no reconnect logic is hand-rolled.
- `EventSource` cannot set headers, so the SSE endpoint takes the session token as a query parameter, an accepted trade-off since the token then appears in the URL.
- A host that supports persistent connections could get a WebSocket event bus behind the same `EventBus` interface without any client change ([ADR 0003](0003-room-state-in-redis-behind-pluggable-backends.md)).
