# Deployment

The two halves of Trade Tycoon are deployed separately. The client is a static
Expo Web export; the server is a Node.js Express app. Both run on Vercel.

## Architecture quick recap

The multiplayer server is **stateless across HTTP requests**. Room state lives
in Redis (Upstash) and cross-instance fan-out goes through Redis pub/sub. This
matters because Vercel serverless functions can route consecutive requests to
different ephemeral instances — anything held in process memory does not
survive across requests.

- Control plane: REST endpoints under `/api/rooms/*`.
- Push channel: Server-Sent Events at `GET /api/rooms/:id/events`.
- State store: Upstash Redis at `room:<roomId>` (24h TTL).
- Fan-out: Upstash Redis pub/sub on `room:<roomId>`.

## One-time setup

### 1. Provision Upstash Redis

1. From the Vercel dashboard → **Marketplace** → install **Upstash Redis**.
2. Connect it to the **server** Vercel project (not the client). This auto-
   adds environment variables to the project.
3. Copy the value of the `REDIS_URL` variable Upstash provided. (If your
   integration only exposes `KV_URL` / `UPSTASH_REDIS_REST_URL`, use the TLS
   connection string from the Upstash console — `rediss://default:<token>@...`.)

### 2. Configure the server project on Vercel

In the server project's **Settings → Environment Variables**:

| Name        | Value                                    | Environments         |
| ----------- | ---------------------------------------- | -------------------- |
| `REDIS_URL` | `rediss://default:<token>@<host>:<port>` | Production + Preview |

Keep the existing build command (`npm run build`) and start command
(auto-detected from the Express app). No `vercel.json` is required —
Vercel auto-detects the Express app via the default export from
`src/index.ts`.

### 3. Configure the client project on Vercel

In the client project's **Settings → Environment Variables**:

| Name                     | Value                                          | Environments         |
| ------------------------ | ---------------------------------------------- | -------------------- |
| `EXPO_PUBLIC_SERVER_URL` | `https://trade-tycoon-server.sohambanerjee.me` | Production + Preview |

Both halves redeploy automatically on the next push to `master`.

## Verifying a deploy

After redeploying, hit these from a terminal:

```bash
# 1. Server is up
curl https://trade-tycoon-server.sohambanerjee.me/api/health
# expected: {"status":"ok"}

# 2. Two-process round-trip works (proves cross-instance fan-out via Redis)
curl -X POST https://trade-tycoon-server.sohambanerjee.me/api/rooms \
  -H 'Content-Type: application/json' -d '{"playerName":"Alice"}'
# returns { roomId, userId, isHost: true }

curl -X POST https://trade-tycoon-server.sohambanerjee.me/api/rooms/<ROOMID>/join \
  -H 'Content-Type: application/json' -d '{"playerName":"Bob"}'
# returns { roomId, userId, isHost: false }
```

If the join returns `404` for a room you just created, Redis isn't wired up —
the two requests hit different function instances and the second one had no
state to look up. Check `REDIS_URL` is set.

## Local development

Start everything with the composite npm script:

```bash
npm start             # api-server + expo web
npm run start:native  # api-server + expo metro (for iOS/Android)
npm run start:server  # api-server only
```

The local server defaults to in-memory state (no `REDIS_URL` needed) since it's
a single Node process.

## Why not WebSockets?

Vercel's standard runtime doesn't terminate WebSockets — the upgrade returns
HTTP 400. SSE is the supported push primitive; the browser's `EventSource`
auto-reconnects on its own when the underlying function times out (~300s on
Vercel), so users see continuous-ish push without WebSocket lifecycle code.

If you ever move the server off Vercel onto a host with WebSocket support
(Render, Fly.io, a VPS), the abstractions in `apps/server/src/store` and
`apps/server/src/events` are deliberately small enough to swap — a future
`WebSocketEventBus` would slot in next to `RedisEventBus` with no client-side
changes.
