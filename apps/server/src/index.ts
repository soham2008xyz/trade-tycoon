import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { InMemoryEventBus } from './events/InMemoryEventBus';
import { RedisRoomStore } from './store/RedisRoomStore';
import { RedisEventBus } from './events/RedisEventBus';
import { InMemoryPresenceStore } from './presence/InMemoryPresenceStore';
import { RedisPresenceStore } from './presence/RedisPresenceStore';
import { createRoomsRouter } from './routes/rooms';
import { createEventsRouter } from './routes/events';
import { errorHandler } from './middleware/errors';
import { parseTrustProxyHops } from './trustProxy';
import { resolveAllowedOrigins } from './allowedOrigins';
import type { RoomStore } from './store/RoomStore';
import type { EventBus } from './events/EventBus';
import type { PresenceStore } from './presence/PresenceStore';

const app = express();

const PORT = process.env.PORT || 3001;

/**
 * Wire the room store, event bus and presence store based on `REDIS_URL`.
 * Setting it picks the Redis-backed set (used in production on Vercel +
 * Upstash); leaving it unset falls back to the single-process in-memory set
 * (tests + local dev).
 */
function buildBackends(): {
  roomStore: RoomStore;
  eventBus: EventBus;
  presenceStore: PresenceStore;
} {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      roomStore: new InMemoryRoomStore(),
      eventBus: new InMemoryEventBus(),
      presenceStore: new InMemoryPresenceStore(),
    };
  }

  // Single shared connection for the publisher + state operations. Subscribers
  // get their own duplicated connection per `RedisEventBus.subscribe` call.
  //
  // We do NOT call `attachDatabasePool(redis)` from `@vercel/functions` here:
  // its 3.5.x runtime check uses node-redis's `options.socket` shape, which
  // ioredis does not have, so the call throws `Unsupported database pool type`
  // at module load and crashes every request with FUNCTION_INVOCATION_FAILED.
  // ioredis's own connection management (lazy connect, auto-reconnect, ready
  // check) is fine on its own; Fluid Compute will still reuse the instance
  // across invocations because `redis` is captured in module scope.
  const redis = new Redis(redisUrl, {
    // ioredis 6 defaults to RESP3. Keep RESP2 for the existing Upstash wire
    // behavior; this upgrade changes the client library, not the protocol.
    protocol: 2,
    // Bound per-command retries so a hung Redis doesn't keep a request open
    // for the full 300s function timeout.
    maxRetriesPerRequest: 3,
    // Keep the default offline queue enabled so the FIRST request after a
    // cold start waits for the TLS handshake to complete instead of failing
    // with "Stream isn't writeable" — Vercel functions cold-start frequently
    // and the queue is the difference between a 200-300ms first hit and a
    // 500.
  });
  redis.on('error', (err) => console.error('[Redis] connection error', err));

  return {
    roomStore: new RedisRoomStore(redis),
    eventBus: new RedisEventBus(redis),
    presenceStore: new RedisPresenceStore(redis),
  };
}

const { roomStore, eventBus, presenceStore } = buildBackends();
const roomManager = new RoomManager(roomStore, { presence: presenceStore });

// Comma-separated allowlist for production (e.g. the deployed web client's
// origin); see allowedOrigins.ts for the fallback and the unset-in-production
// warning.
const { origins: allowedOrigins, warning: allowedOriginsWarning } = resolveAllowedOrigins(
  process.env.ALLOWED_ORIGINS,
  process.env
);
if (allowedOriginsWarning) console.warn(allowedOriginsWarning);

// The rate limiter keys on `req.ip`, which is only the client's address if
// Express skips exactly the proxies in front of it. See trustProxy.ts.
app.set('trust proxy', parseTrustProxyHops(process.env.TRUST_PROXY_HOPS));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '64kb' }));

// Every /api/rooms/* route resolves a session token (join/actions/reconnect/
// leave/events all call into RoomManager auth), so without a limit here an
// attacker could hammer token guesses or just DoS the store. Per-instance
// only — Vercel serverless functions don't share memory across instances —
// but that still meaningfully slows down abuse and satisfies CodeQL
// js/missing-rate-limiting on the SSE route.
app.use(
  '/api/rooms',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(createRoomsRouter({ roomManager, eventBus }));
app.use(createEventsRouter({ roomManager, eventBus }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Trade Tycoon Server is Running' });
});

// Health check for load balancers / Vercel.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Must be registered last — Express 5 forwards rejected async handler
// promises here, so unexpected failures (e.g. a Redis CAS conflict) get a
// structured JSON response instead of Express's default HTML error page.
app.use(errorHandler);

// Don't bind a port when imported as a module (e.g. tests, Vercel auto-detect).
// Only listen when run as the main entry point.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
