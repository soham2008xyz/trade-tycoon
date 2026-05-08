import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import type { LobbyState } from '@trade-tycoon/game-logic';
import { RedisEventBus } from './RedisEventBus';
import type { RoomEvent } from './EventBus';

const lobbyEvent = (roomId: string): RoomEvent => ({
  type: 'lobby_update',
  state: { roomId, players: [], status: 'lobby' } as LobbyState,
});

/**
 * Wait until the predicate returns true, polling every `interval` ms.
 * The Redis mock fans out pub/sub via the next tick, so a tiny wait
 * lets handlers run before assertions.
 */
const waitFor = async (predicate: () => boolean, timeoutMs = 500, interval = 5) => {
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
    redis = new RedisMock() as unknown as Redis;
    await redis.flushall();
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
