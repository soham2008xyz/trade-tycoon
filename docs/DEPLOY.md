# Deployment

The two halves of Trade Tycoon are deployed separately. The client is a static
Expo Web export; the server is a Node.js Express app. Both run on Vercel.
A separate standby copy of both runs on Render's free plans — see
[Render standby](#render-standby).

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
- Presence: Upstash Redis hash at `presence:<roomId>` (24h TTL), written on
  every authenticated player request. No extra env var — it follows
  `REDIS_URL`. A native client's poll now costs a presence write (one
  pipelined round trip) plus a presence read on top of the room read, which
  matters under Upstash's per-command billing. Each open web SSE stream also
  does a presence write, a room read and a presence read every 15 s.

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

| Name              | Value                                                                         | Environments         |
| ----------------- | ----------------------------------------------------------------------------- | -------------------- |
| `REDIS_URL`       | `rediss://default:<token>@<host>:<port>`                                      | Production + Preview |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. the client's deployed URL) | Production + Preview |

`ALLOWED_ORIGINS` falls back to known local-dev origins
(`http://localhost:8081`, `http://localhost:19006`) when unset — always set
it explicitly in any deployed environment.

Keep the existing build command (`npm run build`) and start command
(auto-detected from the Express app). No `vercel.json` is required —
Vercel auto-detects the Express app via the default export from
`src/index.ts`.

### 3. Configure the client project on Vercel

In the client project's **Settings → Environment Variables**:

| Name                            | Value                                          | Environments         |
| ------------------------------- | ---------------------------------------------- | -------------------- |
| `EXPO_PUBLIC_SERVER_URL`        | `https://trade-tycoon-server.sohambanerjee.me` | Production + Preview |
| `EXPO_PUBLIC_GA_MEASUREMENT_ID` | GA4 web stream ID, e.g. `G-XXXXXXXXXX`         | Production           |

`EXPO_PUBLIC_GA_MEASUREMENT_ID` is optional. When it is set, the web build loads
Google Analytics 4 and records a page view per screen plus the
`start_local_game`, `create_room`, `join_room` and `start_online_game` events.
When it is unset or malformed (local dev, Preview), nothing loads and nothing is
sent. Native apps never send analytics. Set it on Production only, so preview
deploys don't skew the numbers. Like every `EXPO_PUBLIC_*` value it is inlined
at build time: changing it needs a redeploy. GA4 doesn't log IP addresses, and
the build turns off Google signals and ad personalisation. There is no consent
banner. If you need one (e.g. for EU visitors), add Consent Mode before the
`config` call in `apps/client/components/analytics.ts`, or switch to a cookieless
tool such as Plausible.

The client's production host is `https://trade-tycoon.sohambanerjee.me`. The
web build's Open Graph and Twitter card tags (`og:url`, `og:image`,
`twitter:image`) point at it through the `SITE_URL` constant in
`apps/client/app/_layout.tsx`. Crawlers need absolute URLs, and a static export
can't read the host at request time, so update that constant if the domain
changes. Check a deploy's link preview with Slack's
<https://www.slack.com/tools/linkpreview>.

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
# returns { roomId, playerId, token, isHost: true }

curl -X POST https://trade-tycoon-server.sohambanerjee.me/api/rooms/<ROOMID>/join \
  -H 'Content-Type: application/json' -d '{"playerName":"Bob"}'
# returns { roomId, playerId, token, isHost: false }
```

If the join returns `404` for a room you just created, Redis isn't wired up —
the two requests hit different function instances and the second one had no
state to look up. Check `REDIS_URL` is set.

## Render standby

`render.yaml` at the repo root is a Render Blueprint for a second,
self-contained stack, all on free plans in the Singapore region:

| Service               | Type                 | URL                                        |
| --------------------- | -------------------- | ------------------------------------------ |
| `trade-tycoon-web`    | Static site          | `https://trade-tycoon-web.onrender.com`    |
| `trade-tycoon-server` | Node web service     | `https://trade-tycoon-server.onrender.com` |
| `trade-tycoon-kv`     | Key Value (Valkey 8) | internal only (`ipAllowList: []`)          |

It shares nothing with production. The Render web client talks only to the
Render server, which stores rooms in Render Key Value instead of Upstash, so a
room created on one stack can't be joined from the other. Native apps keep
using the Vercel server. Moving them over would need a DNS cutover of
`trade-tycoon-server.sohambanerjee.me` (a Cloudflare CNAME to Vercel today),
and then the two stacks would also need to share one Redis.

### Setting it up

1. Render Dashboard → **New → Blueprint** → pick this repo, branch `master`.
   Render reads `render.yaml` and creates all three services. `REDIS_URL` is
   wired from the Key Value instance automatically.
2. Once the services exist, check their `onrender.com` URLs. If Render
   suffixed a name because it was taken, fix `ALLOWED_ORIGINS` and
   `EXPO_PUBLIC_SERVER_URL` in `render.yaml` and push.
   `EXPO_PUBLIC_SERVER_URL` is inlined when Metro transforms the code, and a
   warm Metro cache keeps the old value. After changing it, use **Manual
   Deploy → Clear build cache & deploy**. Locally, pass `--clear` to
   `expo export`.

Validate edits locally with
`render blueprints validate render.yaml --workspace <workspace-id>`.

### Free-plan limits

- **The server spins down** after 15 minutes without inbound requests. The
  next request waits roughly a minute while it boots. The client has no fetch
  timeout, so the first "Create room" just hangs until the server is up.
- **Key Value is not persisted.** A restart or maintenance wipes every room.
  Players with a stored session get `session_expired` on Resume and start
  over. Upgrading the instance to a paid plan also wipes it.
- **Key Value connections are limited.** Each open web SSE stream holds its
  own subscriber connection (see `RedisEventBus`), so the instance's
  connection cap bounds concurrent web players.
- **750 free instance hours per workspace per month**, shared by every free
  web service in the workspace. If they run out, the server is suspended
  until the next month.

### Verifying

Run the same curl checks as [Verifying a deploy](#verifying-a-deploy) against
`https://trade-tycoon-server.onrender.com`, then open the web client and
create a room.

Render puts several proxies in front of the app, so `render.yaml` sets
`TRUST_PROXY_HOPS` (default `1` is right for Vercel). To confirm the value,
run this from one machine a few times within a minute, then repeat with
`-H 'X-Forwarded-For: 9.9.9.1'` and `-H 'X-Forwarded-For: 9.9.9.2'`:

```bash
curl -si https://trade-tycoon-server.onrender.com/api/rooms | grep -i ratelimit-remaining
```

- **Correct:** every call, spoofed or not, counts down one shared sequence
  (119, 118, 117, …).
- **Too low:** plain calls jump between unrelated counts. `req.ip` is
  whichever internal Render proxy handled the connection, so players share
  per-proxy buckets. This is what `1` did on Render.
- **Too high:** a spoofed header starts a fresh count at 119. Clients could
  dodge the limit by faking the header.

Change the value in `render.yaml`, not the dashboard: a Blueprint sync
overwrites dashboard edits.

## Local development

Start everything with the composite npm script:

```bash
npm start             # api-server + expo web
npm run start:native  # api-server + expo metro (for iOS/Android)
npm run start:server  # api-server only
```

The local server defaults to in-memory state (no `REDIS_URL` needed) since it's
a single Node process.

Server integration tests use a real Redis database through `REDIS_TEST_URL`,
which defaults to `redis://127.0.0.1:6379/15`. The suites run `FLUSHDB` before
each test, so use a disposable database and never point `REDIS_TEST_URL` at
production. Production clients set `protocol: 2` explicitly: ioredis 6 uses
RESP3 by default, while this upgrade keeps the existing RESP2 wire behavior.

## Why not WebSockets?

Vercel's standard runtime doesn't terminate WebSockets — the upgrade returns
HTTP 400. SSE is the supported push primitive; the browser's `EventSource`
auto-reconnects on its own when the underlying function times out (~300s on
Vercel), so users see continuous-ish push without WebSocket lifecycle code.

The Render standby could support WebSockets, but it runs the same SSE code so
the two stacks stay identical. If you ever move the server off Vercel onto a
host with WebSocket support (Render, Fly.io, a VPS), the abstractions in `apps/server/src/store` and
`apps/server/src/events` are deliberately small enough to swap — a future
`WebSocketEventBus` would slot in next to `RedisEventBus` with no client-side
changes.
