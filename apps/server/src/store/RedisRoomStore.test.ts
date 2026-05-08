import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import type { LobbyState } from '@trade-tycoon/game-logic';
import { RedisRoomStore } from './RedisRoomStore';

const sampleRoom = (overrides: Partial<LobbyState> = {}): LobbyState => ({
  roomId: 'ABCD1234',
  players: [{ id: 'host', name: 'Host', color: '#FF0000', isHost: true, isReady: true }],
  status: 'lobby',
  ...overrides,
});

describe('RedisRoomStore', () => {
  let redis: Redis;
  let store: RedisRoomStore;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock instances share an underlying in-memory map, so flush
    // before each test to keep state from previous tests from leaking in.
    await redis.flushall();
    store = new RedisRoomStore(redis, { ttlSeconds: 60 });
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('returns null for an unknown room', async () => {
    expect(await store.get('UNKNOWN')).toBeNull();
  });

  it('inserts a new room and returns true', async () => {
    expect(await store.create(sampleRoom())).toBe(true);
    expect((await store.get('ABCD1234'))?.players).toHaveLength(1);
  });

  it('returns false when create collides, leaving existing state untouched', async () => {
    await store.create(
      sampleRoom({
        players: [{ id: 'first', name: 'First', color: '#FF0000', isHost: true, isReady: true }],
      })
    );
    const second = await store.create(
      sampleRoom({
        players: [{ id: 'second', name: 'Second', color: '#0000FF', isHost: true, isReady: true }],
      })
    );
    expect(second).toBe(false);
    expect((await store.get('ABCD1234'))?.players[0].id).toBe('first');
  });

  it('returns null on update when room is missing', async () => {
    expect(await store.update('NOPE', () => sampleRoom())).toBeNull();
  });

  it('returns null on update when mutator aborts and leaves state untouched', async () => {
    await store.create(sampleRoom());
    const result = await store.update('ABCD1234', () => null);
    expect(result).toBeNull();
    expect((await store.get('ABCD1234'))?.players).toHaveLength(1);
  });

  it('persists the mutator result and returns the new state', async () => {
    await store.create(sampleRoom());
    const result = await store.update('ABCD1234', (current) => ({
      ...current,
      players: [
        ...current.players,
        { id: 'p2', name: 'P2', color: '#0000FF', isHost: false, isReady: true },
      ],
    }));
    expect(result?.players).toHaveLength(2);
    expect((await store.get('ABCD1234'))?.players).toHaveLength(2);
  });

  it('removes the room on delete and is idempotent', async () => {
    await store.create(sampleRoom());
    await store.delete('ABCD1234');
    expect(await store.get('ABCD1234')).toBeNull();
    await expect(store.delete('ABCD1234')).resolves.toBeUndefined();
  });

  it('preserves a TTL on the stored room (no negative or "no expire" values)', async () => {
    await store.create(sampleRoom());
    const ttl = await redis.ttl('room:ABCD1234');
    expect(ttl).toBeGreaterThan(0);
  });
});
