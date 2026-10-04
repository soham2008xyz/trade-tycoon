# Online play uses REST plus Server-Sent Events, not WebSockets

The server is deployed as Vercel serverless functions, which do not terminate WebSocket connections (upgrades return HTTP 400). Client-to-server traffic is therefore REST under `/api/rooms/*` and server-to-client push is a Server-Sent Events stream; Socket.IO was dropped. Native clients have no `EventSource`, so they fall back to a version-aware poll of the same room state.

A host that supports persistent connections would allow a WebSocket event bus behind the same `EventBus` interface without client changes (see ADR 0003).
