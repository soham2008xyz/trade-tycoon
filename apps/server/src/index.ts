import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { InMemoryEventBus } from './events/InMemoryEventBus';
import { RedisRoomStore } from './store/RedisRoomStore';
import { RedisEventBus } from './events/RedisEventBus';
import { createRoomsRouter } from './routes/rooms';
import { createEventsRouter } from './routes/events';
import { errorHandler } from './middleware/errors';
import type { RoomStore } from './store/RoomStore';
import type { EventBus } from './events/EventBus';

const app = express();

const PORT = process.env.PORT || 3001;

/**
 * Wire the room store and event bus based on `REDIS_URL`. Setting it picks
 * the Redis-backed pair (used in production on Vercel + Upstash); leaving it
 * unset falls back to the single-process in-memory pair (tests + local dev).
 */
function buildBackends(): { roomStore: RoomStore; eventBus: EventBus } {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      roomStore: new InMemoryRoomStore(),
      eventBus: new InMemoryEventBus(),
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
  };
}

const { roomStore, eventBus } = buildBackends();
const roomManager = new RoomManager(roomStore);

// Comma-separated allowlist for production (e.g. the deployed web client's
// origin). Falls back to known local-dev origins when unset — a wildcard
// fallback would let any site's browser JS read responses (CodeQL
// js/cors-permissive-configuration); production deployments should always
// set ALLOWED_ORIGINS explicitly.
const DEFAULT_DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];
const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins =
  configuredOrigins && configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_DEV_ORIGINS;
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
