import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import { RedisPresenceStore } from './RedisPresenceStore';
import { describePresenceStoreContract } from './presence-store-contract';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379/15';

describe('RedisPresenceStore', () => {
  let redis: Redis;

  beforeEach(async () => {
    redis = new Redis(REDIS_TEST_URL, { protocol: 2, maxRetriesPerRequest: 1 });
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  describePresenceStoreContract(async () => new RedisPresenceStore(redis, { ttlSeconds: 60 }));

  it('expires the room hash so abandoned rooms clean themselves up', async () => {
    const store = new RedisPresenceStore(redis, { ttlSeconds: 60 });
    await store.touch('R1', 'alice', 100);
    const ttl = await redis.ttl('presence:R1');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('gives a seeded-only room a TTL too', async () => {
    const store = new RedisPresenceStore(redis, { ttlSeconds: 60 });
    await store.seedIfAbsent('R2', 'alice', 100);
    expect(await redis.ttl('presence:R2')).toBeGreaterThan(0);
  });
});
