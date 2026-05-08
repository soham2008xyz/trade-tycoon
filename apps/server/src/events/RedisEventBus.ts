import type Redis from 'ioredis';
import type { EventBus, RoomEvent } from './EventBus';

const CHANNEL_PREFIX = 'room:';

/**
 * Cross-instance EventBus backed by Redis pub/sub.
 *
 * The publisher uses the shared `redis` client passed in by the wiring code
 * (the same one `RedisRoomStore` uses). Each subscriber, by contrast, gets a
 * dedicated connection via `redis.duplicate()` — once a connection issues
 * SUBSCRIBE, ioredis puts it in subscriber mode and rejects regular commands
 * on it. Tying the dedicated subscriber's lifetime to the SSE stream means a
 * disconnecting browser frees the connection promptly.
 */
export class RedisEventBus implements EventBus {
  constructor(private readonly redis: Redis) {}

  private channel(roomId: string): string {
    return `${CHANNEL_PREFIX}${roomId}`;
  }

  async publish(roomId: string, event: RoomEvent): Promise<void> {
    await this.redis.publish(this.channel(roomId), JSON.stringify(event));
  }

  async subscribe(roomId: string, handler: (event: RoomEvent) => void): Promise<() => void> {
    const channel = this.channel(roomId);
    const sub = this.redis.duplicate();

    const onMessage = (incomingChannel: string, payload: string) => {
      if (incomingChannel !== channel) return;
      try {
        handler(JSON.parse(payload) as RoomEvent);
      } catch (err) {
        console.error('[RedisEventBus] failed to dispatch event', err);
      }
    };

    sub.on('message', onMessage);
    await sub.subscribe(channel);

    return () => {
      sub.off('message', onMessage);
      // Best-effort unsubscribe; ignore errors because the connection may
      // already be torn down (e.g. function timing out).
      sub.unsubscribe(channel).catch(() => {});
      sub.quit().catch(() => {});
    };
  }
}
