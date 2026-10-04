import type Redis from 'ioredis';
import type { PresenceStore } from './PresenceStore';

const PRESENCE_KEY_PREFIX = 'presence:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // same lifetime as the room itself

/**
 * One hash per room: field = playerId, value = last-seen epoch ms. Each field
 * has a single writer (that player's own requests) and last-write-wins is
 * exactly the wanted semantics, so unlike `RedisRoomStore` there is no CAS.
 */
export class RedisPresenceStore implements PresenceStore {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    options: { ttlSeconds?: number } = {}
  ) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private key(roomId: string): string {
    return `${PRESENCE_KEY_PREFIX}${roomId}`;
  }

  async touch(roomId: string, playerId: string, now: number): Promise<void> {
    const key = this.key(roomId);
    // One round trip: this runs on every native poll, so command count matters
    // on Upstash's per-command billing.
    await this.redis
      .pipeline()
      .hset(key, playerId, String(now))
      .expire(key, this.ttlSeconds)
      .exec();
  }

  async getLastSeen(roomId: string): Promise<ReadonlyMap<string, number>> {
    // `call` returns the raw flat [field, value, …] reply. `hgetall` would
    // build a plain object, where a field named `__proto__` is silently lost.
    const reply = (await this.redis.call('HGETALL', this.key(roomId))) as string[];
    const seen = new Map<string, number>();
    for (let i = 0; i + 1 < reply.length; i += 2) {
      const [field, value] = reply.slice(i, i + 2);
      const at = Number(value);
      if (Number.isFinite(at)) seen.set(field, at);
    }
    return seen;
  }

  async seedIfAbsent(roomId: string, playerId: string, now: number): Promise<void> {
    const key = this.key(roomId);
    await this.redis
      .pipeline()
      .hsetnx(key, playerId, String(now))
      .expire(key, this.ttlSeconds)
      .exec();
  }

  async forget(roomId: string, playerId: string): Promise<void> {
    await this.redis.hdel(this.key(roomId), playerId);
  }
}
