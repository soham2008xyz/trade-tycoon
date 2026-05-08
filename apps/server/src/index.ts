import express from 'express';
import cors from 'cors';
import { Redis } from 'ioredis';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { InMemoryEventBus } from './events/InMemoryEventBus';
import { RedisRoomStore } from './store/RedisRoomStore';
import { RedisEventBus } from './events/RedisEventBus';
import { createRoomsRouter } from './routes/rooms';
import { createEventsRouter } from './routes/events';
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
    // Re-issue commands on temporary disconnects rather than failing them.
    maxRetriesPerRequest: 3,
    // Don't queue forever if Redis is down; fail fast so callers see errors.
    enableOfflineQueue: false,
  });
  redis.on('error', (err) => console.error('[Redis] connection error', err));

  return {
    roomStore: new RedisRoomStore(redis),
    eventBus: new RedisEventBus(redis),
  };
}

const { roomStore, eventBus } = buildBackends();
const roomManager = new RoomManager(roomStore);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '64kb' }));
app.use(createRoomsRouter({ roomManager, eventBus }));
app.use(createEventsRouter({ roomManager, eventBus }));

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

// Health check for load balancers / Vercel.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Don't bind a port when imported as a module (e.g. tests, Vercel auto-detect).
// Only listen when run as the main entry point.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
