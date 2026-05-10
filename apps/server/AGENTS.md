# `apps/server` — Agent Notes

This file complements the **root `AGENTS.md`**. Read that first for the
project map, cross-cutting architecture invariants, and the "one fact,
one home" rule. This file covers only what's specific to the server
workspace.

## Layout

```text
src/
  index.ts                    Express app + buildBackends() wiring
  RoomManager.ts              Business logic — async, takes a RoomStore
  routes/
    rooms.ts                  REST endpoints
    rooms.test.ts             Supertest integration tests
    events.ts                 SSE stream
    events.test.ts            Real-HTTP SSE tests
  store/
    RoomStore.ts              Storage interface
    InMemoryRoomStore.ts      Tests + dev
    InMemoryRoomStore.test.ts
    RedisRoomStore.ts         Production (Upstash via ioredis)
    RedisRoomStore.test.ts    Uses ioredis-mock
  events/
    EventBus.ts               Pub/sub interface
    InMemoryEventBus.ts       Tests + dev
    InMemoryEventBus.test.ts
    RedisEventBus.ts          Production
    RedisEventBus.test.ts
```

## Adding a new REST endpoint

The pattern in `routes/rooms.ts` is:

1. **Validate input.** Coerce `req.params.roomId` with
   `String(req.params.roomId).trim().toUpperCase()` (the `String(...)`
   is required — Express 5 types path params as `string | string[]`).
   Coerce body strings via the local `parseNonEmptyString` helper.
   Reject malformed input with `res.status(400).json({ error: '...' })`.
2. **Mutate state through `RoomManager`** — never poke the store
   directly from a route handler. The manager owns the business logic;
   the route is just an HTTP adapter.
3. **Publish on `EventBus`** after a successful mutation, with one of
   the typed `RoomEvent` variants. Open SSE streams subscribe to this
   bus and forward events to clients.
4. **Use proper HTTP status codes.** 200 for ok, 201 for create, 400
   for bad input, 403 for "not allowed" (e.g. user not in game), 404
   for missing room, 409 for "valid request but state forbids it"
   (room full, game started, action rejected).

A new endpoint usually means a new test in `routes/rooms.test.ts` —
keep it close to the existing structure.

## Test idioms

`vitest` + `supertest`, run with `npm test --workspace=apps/server`.

- **`buildApp()` factory** at the top of `routes/rooms.test.ts` mounts a
  fresh Express app with `InMemoryRoomStore` + `InMemoryEventBus` per
  test. Reach for it instead of doing the wiring inline.
- **Subscribe to the bus to assert events.** When a route is supposed
  to emit a `lobby_update` or `game_state_update`, register a subscriber
  on the in-memory bus *before* calling the route, then assert on the
  array of received events. The current trade- and start-game tests
  show the pattern.
- **For SSE**, use `events.test.ts` as the template. It boots a real
  HTTP server (`createServer(app).listen(0)`) and uses native `fetch`
  with a tiny SSE-frame parser to read events. Don't bring in a
  heavier SSE client; the parser is ~10 lines and matches our
  `event: foo\ndata: ...\n\n` output exactly.
- **Redis-backed tests** use `ioredis-mock`. **Always
  `await redis.flushall()` in `beforeEach`** — `new RedisMock()`
  instances share an underlying in-memory map and one test will
  pollute the next.
- **For boundaries the reducer no-ops** (third-party ACCEPT_TRADE,
  non-initiator CANCEL_TRADE, …) the route returns HTTP 200 with the
  unchanged state. Tests assert state-is-unchanged, not 409. The 409
  path is for the `userId !== action.playerId` impersonation guard
  alone.

## SSE handler lifecycle

`routes/events.ts` is the canonical example. The shape:

1. Set headers (`Content-Type: text/event-stream`,
   `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`,
   `X-Accel-Buffering: no`) and call `res.flushHeaders()`.
2. Write an **initial snapshot** so the client doesn't have to wait
   for the next mutation.
3. `await eventBus.subscribe(roomId, writeEvent)` — the returned
   handle is the unsubscribe.
4. Set a **15-second heartbeat** (`res.write(': ping\n\n')`) so
   intermediaries don't tear down the connection.
5. On `req.on('close', cleanup)` (and `req.on('aborted', cleanup)`):
   clear the heartbeat, unsubscribe, end the response. The cleanup
   must run on the function's natural 300s timeout too — Vercel
   eventually closes the request and we get the close event.

## Vercel + ioredis gotchas

These cost us a production outage; please don't relearn them.

- **Do not call `attachDatabasePool(redis)` from `@vercel/functions`.**
  The 3.5.x runtime detects pools via `'socket' in dbPool.options`,
  which is the **node-redis** option shape. ioredis's options are flat
  (`{ host, port, … }`), so it falls through every branch and throws
  `Unsupported database pool type` at module load — every request
  becomes `FUNCTION_INVOCATION_FAILED` until a fresh deploy. The
  package's docs claim ioredis support; the runtime check disagrees.
- **Do not set `enableOfflineQueue: false`.** Vercel cold starts run
  `new Redis(url)` and immediately receive the next HTTP request;
  with the queue disabled, the first command fires before the TLS
  handshake completes and you get `Stream isn't writeable` 500s.
  Keep the default `true` so commands buffer through the handshake.
  Bound retries via `maxRetriesPerRequest` so a hung Redis doesn't
  hold a request open for the full 300s.
- **WebSocket upgrades return HTTP 400** on standard Vercel functions.
  Don't try Socket.IO, `ws`, or any other persistent-connection
  library here. SSE is the supported push primitive.
- **Each HTTP request can land on a different lambda instance** with
  its own memory, so anything held in process state is invisible to
  the next request. This is why state lives in Redis and fan-out goes
  through Redis pub/sub. If a feature works locally and breaks in
  prod across browsers, suspect this first.

## ioredis idioms

- **Lua scripts via `redis.defineCommand('name', { numberOfKeys, lua })`**
  — ioredis caches the script and dispatches via EVALSHA on each
  call. See `RedisRoomStore.ts`'s `roomCas` for the canonical example.
  Do not invoke the raw Redis `EVAL` command from JavaScript directly:
  the local-string spelling of the JS method ALSO triggers the
  harness's substring-based security warning even though it's
  Lua-only, and `defineCommand` is faster anyway.
- **A SUBSCRIBE-mode connection is dedicated.** Once a connection
  issues `SUBSCRIBE`, ioredis rejects regular commands on it. Use
  `redis.duplicate()` per `RedisEventBus.subscribe` call so each SSE
  stream owns its own subscriber connection; release it in the
  unsubscribe handle.

## Express auto-detect on Vercel

`index.ts` ends with:

```ts
export default app;
if (require.main === module) {
  app.listen(PORT, () => { ... });
}
```

The `export default app` is what Vercel's Express auto-detect imports.
If you `app.listen(...)` unconditionally at module load, Vercel can't
mount cleanly (and tests grab a port). Don't change this idiom without
understanding both consequences.
