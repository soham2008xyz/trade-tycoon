import type Redis from 'ioredis';
import type { LobbyState } from '@trade-tycoon/game-logic';
import type { RoomStore } from './RoomStore';

const ROOM_KEY_PREFIX = 'room:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const MAX_UPDATE_RETRIES = 5;

/**
 * Atomic compare-and-swap script. Reads the current value, compares it
 * byte-for-byte with the caller's expected JSON, and only writes the new
 * value if they still match. Returns 1 on success, 0 on conflict.
 *
 * Doing the CAS inside Redis (one round trip) avoids the WATCH/MULTI/EXEC
 * pattern, which would tie the transaction to a single TCP connection and
 * head-of-line block concurrent updates against the shared publisher
 * connection.
 */
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

const CAS_COMMAND = 'roomCas';

interface RedisWithRoomCas {
  roomCas(key: string, expected: string, next: string, ttlSeconds: string): Promise<number>;
}

export class RedisRoomStore implements RoomStore {
  private readonly ttlSeconds: number;
  private readonly cas: RedisWithRoomCas;

  constructor(
    private readonly redis: Redis,
    options: { ttlSeconds?: number } = {}
  ) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    // Register the CAS Lua script as a custom command on this connection. ioredis
    // ships the script to the server once (SCRIPT LOAD) and cached EVALSHA-calls
    // it thereafter, so this is faster than EVAL on every update too.
    if (!(redis as unknown as { [k: string]: unknown })[CAS_COMMAND]) {
      redis.defineCommand(CAS_COMMAND, { numberOfKeys: 1, lua: CAS_SCRIPT });
    }
    this.cas = redis as unknown as RedisWithRoomCas;
  }

  private key(roomId: string): string {
    return `${ROOM_KEY_PREFIX}${roomId}`;
  }

  async get(roomId: string): Promise<LobbyState | null> {
    const json = await this.redis.get(this.key(roomId));
    if (!json) return null;
    try {
      return JSON.parse(json) as LobbyState;
    } catch (err) {
      console.error(`[RedisRoomStore] Failed to parse room ${roomId}`, err);
      return null;
    }
  }

  async create(state: LobbyState): Promise<boolean> {
    // SET NX EX: atomically insert only if the key doesn't already exist,
    // with a 24h TTL so abandoned rooms self-clean.
    const result = await this.redis.set(
      this.key(state.roomId),
      JSON.stringify(state),
      'EX',
      this.ttlSeconds,
      'NX'
    );
    return result === 'OK';
  }

  async update(
    roomId: string,
    mutator: (current: LobbyState) => LobbyState | null
  ): Promise<LobbyState | null> {
    const key = this.key(roomId);
    for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt++) {
      const json = await this.redis.get(key);
      if (json === null) return null;

      let current: LobbyState;
      try {
        current = JSON.parse(json) as LobbyState;
      } catch (err) {
        console.error(`[RedisRoomStore] Corrupt JSON for ${roomId}`, err);
        return null;
      }

      const next = mutator(current);
      if (next === null) return null;

      const written = await this.cas.roomCas(
        key,
        json,
        JSON.stringify(next),
        String(this.ttlSeconds)
      );

      if (written === 1) return next;
      // Otherwise: another writer beat us; loop and re-read.
    }
    throw new Error(
      `[RedisRoomStore] update conflict on ${roomId} after ${MAX_UPDATE_RETRIES} retries`
    );
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.del(this.key(roomId));
  }
}
