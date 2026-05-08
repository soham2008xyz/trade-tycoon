import { describe, it, expect, beforeEach } from 'vitest';
import type { LobbyState } from '@trade-tycoon/game-logic';
import { InMemoryRoomStore } from './InMemoryRoomStore';

const sampleRoom = (overrides: Partial<LobbyState> = {}): LobbyState => ({
  roomId: 'ABCD1234',
  players: [{ id: 'host', name: 'Host', color: '#FF0000', isHost: true, isReady: true }],
  status: 'lobby',
  ...overrides,
});

describe('InMemoryRoomStore', () => {
  let store: InMemoryRoomStore;

  beforeEach(() => {
    store = new InMemoryRoomStore();
  });

  describe('get', () => {
    it('returns null for an unknown room', async () => {
      expect(await store.get('UNKNOWN')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts a new room and returns true', async () => {
      const created = await store.create(sampleRoom());
      expect(created).toBe(true);
      expect((await store.get('ABCD1234'))?.players).toHaveLength(1);
    });

    it('returns false when the room id collides, leaving the existing state untouched', async () => {
      await store.create(
        sampleRoom({
          players: [{ id: 'first', name: 'First', color: '#FF0000', isHost: true, isReady: true }],
        })
      );
      const second = await store.create(
        sampleRoom({
          players: [
            { id: 'second', name: 'Second', color: '#0000FF', isHost: true, isReady: true },
          ],
        })
      );
      expect(second).toBe(false);
      const stored = await store.get('ABCD1234');
      expect(stored?.players[0].id).toBe('first');
    });
  });

  describe('update', () => {
    it('returns null when the room is missing', async () => {
      const result = await store.update('NOPE', () => sampleRoom());
      expect(result).toBeNull();
    });

    it('returns null when the mutator aborts (returns null)', async () => {
      await store.create(sampleRoom());
      const result = await store.update('ABCD1234', () => null);
      expect(result).toBeNull();
      // Original state untouched.
      expect((await store.get('ABCD1234'))?.players).toHaveLength(1);
    });

    it('writes back the mutator result and returns the new state', async () => {
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

    it('passes the latest stored state into the mutator on each call', async () => {
      await store.create(sampleRoom());
      // Bump version twice; second call must observe the first call's write.
      await store.update('ABCD1234', (s) => ({ ...s, status: 'lobby' }));
      const seen: number[] = [];
      await store.update('ABCD1234', (s) => {
        seen.push(s.players.length);
        return {
          ...s,
          players: [
            ...s.players,
            { id: 'p2', name: 'P2', color: '#0000FF', isHost: false, isReady: true },
          ],
        };
      });
      await store.update('ABCD1234', (s) => {
        seen.push(s.players.length);
        return null;
      });
      expect(seen).toEqual([1, 2]);
    });
  });

  describe('delete', () => {
    it('removes the room and is idempotent', async () => {
      await store.create(sampleRoom());
      await store.delete('ABCD1234');
      expect(await store.get('ABCD1234')).toBeNull();
      // Second delete must not throw.
      await expect(store.delete('ABCD1234')).resolves.toBeUndefined();
    });
  });
});
