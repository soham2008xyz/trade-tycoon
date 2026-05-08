import type { LobbyState } from '@trade-tycoon/game-logic';
import type { RoomStore } from './RoomStore';

/**
 * In-memory implementation used by tests and local single-process runs. The
 * Map is the single source of truth, and every mutation is synchronous within
 * one Node process — no need for the WATCH/retry dance the Redis impl performs.
 *
 * Each call still goes through the async interface so that callers behave the
 * same way whether they are wired to this store or the Redis one.
 */
export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, LobbyState>();

  async get(roomId: string): Promise<LobbyState | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async create(state: LobbyState): Promise<boolean> {
    if (this.rooms.has(state.roomId)) return false;
    this.rooms.set(state.roomId, state);
    return true;
  }

  async update(
    roomId: string,
    mutator: (current: LobbyState) => LobbyState | null
  ): Promise<LobbyState | null> {
    const current = this.rooms.get(roomId);
    if (!current) return null;
    const next = mutator(current);
    if (!next) return null;
    this.rooms.set(roomId, next);
    return next;
  }

  async delete(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }
}
