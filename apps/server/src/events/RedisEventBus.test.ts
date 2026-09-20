import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import type { LobbyState } from '@trade-tycoon/game-logic';
import { RedisEventBus } from './RedisEventBus';
import type { RoomEvent } from './EventBus';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379/15';

const lobbyEvent = (roomId: string): RoomEvent => ({
  type: 'lobby_update',
  state: { roomId, players: [], status: 'lobby' } as LobbyState,
});

/**
 * Wait until the predicate returns true, polling every `interval` ms.
 * Redis pub/sub delivery is asynchronous, so poll until the subscriber has
 * handled the message instead of relying on a fixed scheduling delay.
 */
const waitFor = async (predicate: () => boolean, timeoutMs = 1_000, interval = 5) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('waitFor timed out');
};

describe('RedisEventBus', () => {
  let redis: Redis;
  let bus: RedisEventBus;

  beforeEach(async () => {
    redis = new Redis(REDIS_TEST_URL, { protocol: 2, maxRetriesPerRequest: 1 });
    await redis.flushdb();
    bus = new RedisEventBus(redis);
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('delivers events to subscribers of the same room', async () => {
    const received: RoomEvent[] = [];
    const unsub = await bus.subscribe('R1', (ev) => received.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    await waitFor(() => received.length === 1);
    expect(received[0].type).toBe('lobby_update');
    unsub();
  });

  it('does not leak events across rooms', async () => {
    const received: RoomEvent[] = [];
    const unsub = await bus.subscribe('R1', (ev) => received.push(ev));
    await bus.publish('R2', lobbyEvent('R2'));
    // Give pub/sub a moment to (not) deliver.
    await new Promise((r) => setTimeout(r, 30));
    expect(received).toHaveLength(0);
    unsub();
  });

  it('stops delivering after unsubscribe', async () => {
    const received: RoomEvent[] = [];
    const unsub = await bus.subscribe('R1', (ev) => received.push(ev));
    unsub();
    await new Promise((r) => setTimeout(r, 10));
    await bus.publish('R1', lobbyEvent('R1'));
    await new Promise((r) => setTimeout(r, 30));
    expect(received).toHaveLength(0);
  });

  it('fans out a single publish to multiple subscribers', async () => {
    const a: RoomEvent[] = [];
    const b: RoomEvent[] = [];
    const unsubA = await bus.subscribe('R1', (ev) => a.push(ev));
    const unsubB = await bus.subscribe('R1', (ev) => b.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    await waitFor(() => a.length === 1 && b.length === 1);
    unsubA();
    unsubB();
  });
});
