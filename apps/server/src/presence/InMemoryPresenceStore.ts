import type { PresenceStore } from './PresenceStore';

/**
 * In-memory presence for tests and single-process local runs. Everything is
 * synchronous; the methods return resolved promises only to match the
 * `PresenceStore` interface the Redis implementation needs.
 */
export class InMemoryPresenceStore implements PresenceStore {
  private readonly rooms = new Map<string, Map<string, number>>();

  touch(roomId: string, playerId: string, now: number): Promise<void> {
    const room = this.rooms.get(roomId) ?? new Map<string, number>();
    room.set(playerId, now);
    this.rooms.set(roomId, room);
    return Promise.resolve();
  }

  getLastSeen(roomId: string): Promise<ReadonlyMap<string, number>> {
    // Copy so a caller can't mutate the store through the returned map.
    return Promise.resolve(new Map(this.rooms.get(roomId) ?? []));
  }

  seedIfAbsent(roomId: string, playerId: string, now: number): Promise<void> {
    const room = this.rooms.get(roomId) ?? new Map<string, number>();
    if (!room.has(playerId)) room.set(playerId, now);
    this.rooms.set(roomId, room);
    return Promise.resolve();
  }

  forget(roomId: string, playerId: string): Promise<void> {
    this.rooms.get(roomId)?.delete(playerId);
    return Promise.resolve();
  }
}
