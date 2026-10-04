import type { PresenceStore } from './PresenceStore';

/** In-memory presence for tests and single-process local runs. */
export class InMemoryPresenceStore implements PresenceStore {
  private readonly rooms = new Map<string, Map<string, number>>();

  async touch(roomId: string, playerId: string, now: number): Promise<void> {
    const room = this.rooms.get(roomId) ?? new Map<string, number>();
    room.set(playerId, now);
    this.rooms.set(roomId, room);
  }

  async getLastSeen(roomId: string): Promise<ReadonlyMap<string, number>> {
    // Copy so a caller can't mutate the store through the returned map.
    return new Map(this.rooms.get(roomId) ?? []);
  }

  async seedIfAbsent(roomId: string, playerId: string, now: number): Promise<void> {
    const room = this.rooms.get(roomId) ?? new Map<string, number>();
    if (!room.has(playerId)) room.set(playerId, now);
    this.rooms.set(roomId, room);
  }

  async forget(roomId: string, playerId: string): Promise<void> {
    this.rooms.get(roomId)?.delete(playerId);
  }
}
