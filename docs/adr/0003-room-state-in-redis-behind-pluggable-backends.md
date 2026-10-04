# Room state lives in Redis behind two pluggable interfaces

Each HTTP request can land on a different serverless instance with its own memory, so a room's state cannot live in process memory. Production keeps each room as one record in Upstash Redis and fans events out over Redis pub/sub, while tests and local development use in-memory implementations. The server only reaches storage through `RoomStore` and only broadcasts through `EventBus`, selected by whether `REDIS_URL` is set.

`RoomStore.update` is an atomic compare-and-swap, so two simultaneous actions on one room cannot overwrite each other. A mutator passed to it may run more than once on a conflict and must therefore be a pure function of its input; anything that has to happen exactly once, such as generating an id or a random seed, is done outside it (see [ADR 0006](0006-server-owned-replayable-randomness.md)).

## Considered options

- **WATCH/MULTI/EXEC for the compare-and-swap.** Rejected in favour of a Lua script registered through ioredis `defineCommand`, which runs as a single cached `EVALSHA` round trip. WATCH/MULTI/EXEC would have blocked other commands on the shared connection while a transaction was in flight.

## Consequences

- Creating a room is a `SET NX`, so two simultaneous creations of the same room id cannot both succeed. A compare-and-swap that keeps losing is retried a bounded number of times and then surfaces as a 503 asking the caller to retry.
- Rooms expire after 24 hours, so abandoned lobbies clean themselves up.
- A Redis subscriber connection can run no other commands, so each SSE stream gets its own duplicated connection, released when the stream ends.
- Single-process in-memory state hides the multi-instance problem. A feature that works locally but misbehaves across browsers in production should be suspected of holding state in process memory.
