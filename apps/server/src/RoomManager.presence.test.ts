import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import type { RoomStore } from './store/RoomStore';
import { InMemoryPresenceStore } from './presence/InMemoryPresenceStore';
import { PRESENCE_TIMEOUT_MS, type PresenceStore } from './presence/PresenceStore';

const START = 1_000_000;
const STALE = PRESENCE_TIMEOUT_MS + 1_000;

interface Seat {
  playerId: string;
  token: string;
}

/**
 * Builds a started online game with `names.length` players (the first is the
 * host) on a controllable clock, so tests can age presence deterministically.
 */
export const setupGame = async (
  names: string[],
  overrides: { presence?: PresenceStore; store?: RoomStore } = {}
) => {
  const store = overrides.store ?? new InMemoryRoomStore();
  const presence = overrides.presence ?? new InMemoryPresenceStore();
  const clock = { now: START };
  const manager = new RoomManager(store, { presence, clock: () => clock.now });

  const created = await manager.createRoom(names[0]);
  const seats: Seat[] = [{ playerId: created.playerId, token: created.token }];
  for (const name of names.slice(1)) {
    const joined = await manager.joinRoom(created.roomId, name);
    if (!joined.ok) throw new Error(`join failed: ${joined.message}`);
    seats.push({ playerId: joined.playerId, token: joined.token });
  }
  const started = await manager.startGame(created.roomId, seats[0].token);
  if (!started.ok) throw new Error(`start failed: ${started.message}`);

  return { manager, store, presence, clock, roomId: created.roomId, seats };
};

/** Simulates bankruptcy: gone from the game roster, still in lobby + sessions. */
export const bankrupt = async (store: RoomStore, roomId: string, playerId: string) => {
  await store.update(roomId, (current) => ({
    ...current,
    gameState: current.gameState && {
      ...current.gameState,
      players: current.gameState.players.filter((p) => p.id !== playerId),
    },
  }));
};

describe('RoomManager presence', () => {
  describe('heartbeats', () => {
    it('touches the host on create and a player on join', async () => {
      const { presence, roomId, seats } = await setupGame(['Alice', 'Bob']);
      const seen = await presence.getLastSeen(roomId);
      expect(seen.get(seats[0].playerId)).toBe(START);
      expect(seen.get(seats[1].playerId)).toBe(START);
    });

    it('touches on reconnect', async () => {
      const { manager, presence, clock, roomId, seats } = await setupGame(['Alice', 'Bob']);
      clock.now = START + 10_000;
      const result = await manager.reconnect(roomId, seats[1].token);
      expect(result.ok).toBe(true);
      expect((await presence.getLastSeen(roomId)).get(seats[1].playerId)).toBe(START + 10_000);
    });

    it('does not touch for a stale token on reconnect', async () => {
      const { manager, presence, clock, roomId } = await setupGame(['Alice', 'Bob']);
      clock.now = START + 10_000;
      const result = await manager.reconnect(roomId, 'not-a-token');
      expect(result.ok).toBe(false);
      const seen = await presence.getLastSeen(roomId);
      expect([...seen.values()].every((at) => at === START)).toBe(true);
    });

    it('touches on a game action even when the action is rejected', async () => {
      const { manager, presence, clock, roomId, seats } = await setupGame(['Alice', 'Bob']);
      clock.now = START + 20_000;
      // Bob acting out of turn is a rejected no-op, but proves he is alive.
      const result = await manager.handleGameAction(roomId, seats[1].token, {
        type: 'ROLL_DICE',
        playerId: seats[1].playerId,
      });
      expect(result.ok).toBe(false);
      expect((await presence.getLastSeen(roomId)).get(seats[1].playerId)).toBe(START + 20_000);
    });

    it('never touches presence from inside the store mutator', async () => {
      const events: string[] = [];
      const inner = new InMemoryRoomStore();
      const store: RoomStore = {
        get: (id) => inner.get(id),
        create: (s) => inner.create(s),
        delete: (id) => inner.delete(id),
        update: (id, mutator) =>
          inner.update(id, (current) => {
            events.push('mutator-start');
            const next = mutator(current);
            events.push('mutator-end');
            return next;
          }),
      };
      const inMemory = new InMemoryPresenceStore();
      const presence: PresenceStore = {
        touch: (r, p, n) => {
          events.push('touch');
          return inMemory.touch(r, p, n);
        },
        getLastSeen: (r) => inMemory.getLastSeen(r),
        seedIfAbsent: (r, p, n) => inMemory.seedIfAbsent(r, p, n),
        forget: (r, p) => inMemory.forget(r, p),
      };
      const { manager, roomId, seats } = await setupGame(['Alice', 'Bob'], { presence, store });
      events.length = 0;

      await manager.handleGameAction(roomId, seats[0].token, {
        type: 'ROLL_DICE',
        playerId: seats[0].playerId,
      });

      const touchAt = events.indexOf('touch');
      expect(touchAt).toBeGreaterThan(-1);
      expect(events.lastIndexOf('mutator-end')).toBeLessThan(touchAt);
    });

    it('does not fail the request when the presence store throws', async () => {
      const broken: PresenceStore = {
        touch: async () => {
          throw new Error('redis down');
        },
        getLastSeen: async () => {
          throw new Error('redis down');
        },
        seedIfAbsent: async () => {
          throw new Error('redis down');
        },
        forget: async () => {
          throw new Error('redis down');
        },
      };
      const { manager, roomId, seats } = await setupGame(['Alice', 'Bob'], { presence: broken });
      const result = await manager.reconnect(roomId, seats[0].token);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.disconnectedPlayerIds).toEqual([]);
    });
  });

  describe('getDisconnectedPlayerIds', () => {
    let ctx: Awaited<ReturnType<typeof setupGame>>;
    beforeEach(async () => {
      ctx = await setupGame(['Alice', 'Bob', 'Cara']);
    });

    it('is empty while everyone is fresh', async () => {
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([]);
    });

    it('flags a player unseen past the timeout, not before it', async () => {
      ctx.clock.now = START + PRESENCE_TIMEOUT_MS - 1_000;
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([]);

      ctx.clock.now = START + STALE;
      // Alice and Cara keep polling; Bob is silent.
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[0].playerId);
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[2].playerId);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([
        ctx.seats[1].playerId,
      ]);
    });

    it('clears when the player comes back', async () => {
      ctx.clock.now = START + STALE;
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[0].playerId);
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[2].playerId);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toHaveLength(1);

      await ctx.manager.reconnect(ctx.roomId, ctx.seats[1].token);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([]);
    });

    it('is empty before a game starts', async () => {
      const lobby = await ctx.manager.createRoom('Solo');
      ctx.clock.now = START + STALE;
      expect(await ctx.manager.getDisconnectedPlayerIds(lobby.roomId)).toEqual([]);
    });

    it('is empty for an unknown room', async () => {
      expect(await ctx.manager.getDisconnectedPlayerIds('NOPE')).toEqual([]);
    });

    it('seeds a player with no record so they go stale later, not never', async () => {
      await ctx.presence.forget(ctx.roomId, ctx.seats[1].playerId);
      // First read: no record → present, but seeded at "now".
      ctx.clock.now = START + 5_000;
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[0].playerId);
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[2].playerId);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([]);

      ctx.clock.now = START + 5_000 + STALE;
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[0].playerId);
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[2].playerId);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([
        ctx.seats[1].playerId,
      ]);
    });

    it('still reports a bankrupt player (gone from the game roster) when stale', async () => {
      await bankrupt(ctx.store, ctx.roomId, ctx.seats[1].playerId);
      ctx.clock.now = START + STALE;
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[0].playerId);
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[2].playerId);
      expect(await ctx.manager.getDisconnectedPlayerIds(ctx.roomId)).toEqual([
        ctx.seats[1].playerId,
      ]);
    });
  });
});
