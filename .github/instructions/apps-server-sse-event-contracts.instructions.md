---
description: Server SSE event contracts for room-scoped streams. Use when editing events route, EventBus contracts, or SSE integration tests.
applyTo: 'apps/server/src/{routes/events.ts,routes/events.test.ts,events/EventBus.ts,events/InMemoryEventBus.ts,events/RedisEventBus.ts}'
---

# Server SSE Event Contracts

Keep SSE behavior stable for reconnecting clients and cross-instance fan-out.

## Event Types And Payload Shape

- Emit only typed room events:
  - `lobby_update` with `LobbyState`
  - `game_state_update` with the server-safe `GameState` snapshot shape used by clients
- Preserve the SSE frame format:
  - `event: <type>`
  - `data: <json>`
  - blank line terminator
- Do not switch to generic `message` events for room updates.

## Stream Admission Rules

For `GET /api/rooms/:roomId/events`:

- `400` when `userId` query parameter is missing/empty.
- `404` when room does not exist.
- `403` when user is in neither lobby nor running game.
- `200` only for authorized room participants.

## Initial Snapshot Contract

On successful stream open, write immediate snapshots before subscription fan-out:

1. Always send `lobby_update` first.
2. Send `game_state_update` next only when game exists.

This initial snapshot must be enough for clients to render without waiting for a mutation.

## Headers And Connection Behavior

Keep SSE headers intact:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

Call `flushHeaders()` when available.

## Heartbeat And Cleanup

- Send heartbeat comments (`: ping`) every ~15 seconds.
- Always unsubscribe from EventBus on request close/abort.
- Clear heartbeat timers during cleanup.
- End the response safely in cleanup without throwing.

## EventBus Contract

- `publish(roomId, event)` broadcasts to all current subscribers.
- `subscribe(roomId, handler)` returns an unsubscribe handle and must not leak resources.
- SSE route owns initial snapshot responsibility; EventBus only handles post-subscription events.

## Testing Requirements

When SSE contract changes:

- Update `apps/server/src/routes/events.test.ts`.
- Cover status boundaries (`400/403/404/200`).
- Assert initial event order and payload validity.
- Assert forwarding of published events after subscription.
- Verify started-game snapshots do not leak board data.

## Verification

- Run `npm test --workspace=apps/server` after SSE contract changes.

## References

- [apps/server/AGENTS.md](../../apps/server/AGENTS.md)
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- [AGENTS.md](../../AGENTS.md)
