# Room state lives in Redis behind two pluggable interfaces

Each HTTP request can land on a different serverless instance with its own memory, so a room's state cannot live in process memory. Production keeps rooms in Upstash Redis and fans events out over Redis pub/sub, while tests and local development use in-memory implementations. The server only reaches storage through `RoomStore` and broadcasts only through `EventBus`, selected by whether `REDIS_URL` is set.

`RoomStore.update` is an atomic compare-and-swap, so two simultaneous actions on one room cannot overwrite each other. A mutator passed to it may run more than once on a conflict and must therefore be a pure function of its input.
