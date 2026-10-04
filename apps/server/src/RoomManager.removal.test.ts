import { describe, it, expect } from 'vitest';
import { START, bankrupt, setupGame, silenceAllBut } from './test-utils/room-game';
import type { PresenceStore } from './presence/PresenceStore';
import { InMemoryPresenceStore } from './presence/InMemoryPresenceStore';

type Ctx = Awaited<ReturnType<typeof setupGame>>;

/** Three-player game: Alice (host), Bob, Cara. */
const threePlayers = (overrides?: Parameters<typeof setupGame>[1]) =>
  setupGame(['Alice', 'Bob', 'Cara'], overrides);

const versionOf = async (ctx: Ctx) => (await ctx.store.get(ctx.roomId))?.version;

const expectRejected = async (
  ctx: Ctx,
  run: () => ReturnType<Ctx['manager']['removeDisconnectedPlayer']>,
  reason: 'unauthorized' | 'conflict' | 'not_found',
  message?: string
) => {
  const before = await versionOf(ctx);
  const result = await run();
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe(reason);
  if (message) expect(result.message).toBe(message);
  expect(await versionOf(ctx)).toBe(before); // nothing persisted
};

describe('RoomManager.removeDisconnectedPlayer', () => {
  it('lets the host remove a disconnected player, who then loses their session', async () => {
    const ctx = await threePlayers();
    const [alice, bob, cara] = ctx.seats;
    await silenceAllBut(ctx, [alice, bob]);

    const result = await ctx.manager.removeDisconnectedPlayer(
      ctx.roomId,
      alice.token,
      cara.playerId
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.map((p) => p.id)).toEqual([alice.playerId, bob.playerId]);
    expect(result.gameState?.players.map((p) => p.id)).toEqual([alice.playerId, bob.playerId]);
    expect((result.state as { sessions?: unknown }).sessions).toBeUndefined();

    const back = await ctx.manager.reconnect(ctx.roomId, cara.token);
    expect(back).toEqual({ ok: false, reason: 'not_found', message: 'session_expired' });
  });

  it('advances the turn when the removed player is the current one', async () => {
    const ctx = await threePlayers();
    const [alice, bob, cara] = ctx.seats;
    await ctx.store.update(ctx.roomId, (c) => ({
      ...c,
      gameState: c.gameState && { ...c.gameState, currentPlayerId: cara.playerId },
    }));
    await silenceAllBut(ctx, [alice, bob]);

    const result = await ctx.manager.removeDisconnectedPlayer(
      ctx.roomId,
      alice.token,
      cara.playerId
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gameState?.currentPlayerId).toBe(alice.playerId);
  });

  it('forgets the removed player presence', async () => {
    const ctx = await threePlayers();
    const [alice, bob, cara] = ctx.seats;
    await silenceAllBut(ctx, [alice, bob]);
    await ctx.manager.removeDisconnectedPlayer(ctx.roomId, alice.token, cara.playerId);
    expect((await ctx.presence.getLastSeen(ctx.roomId)).has(cara.playerId)).toBe(false);
  });

  describe('rejections persist nothing', () => {
    it('unknown token → unauthorized', async () => {
      const ctx = await threePlayers();
      await silenceAllBut(ctx, [ctx.seats[0]]);
      await expectRejected(
        ctx,
        () => ctx.manager.removeDisconnectedPlayer(ctx.roomId, 'nope', ctx.seats[2].playerId),
        'unauthorized'
      );
    });

    it('unknown room → not_found', async () => {
      const ctx = await threePlayers();
      const result = await ctx.manager.removeDisconnectedPlayer(
        'NOROOM00',
        ctx.seats[0].token,
        ctx.seats[1].playerId
      );
      expect(result).toMatchObject({ ok: false, reason: 'not_found' });
    });

    it('no game running → conflict', async () => {
      const ctx = await threePlayers();
      // A second room that never started.
      const lobby = await ctx.manager.createRoom('Solo');
      const joined = await ctx.manager.joinRoom(lobby.roomId, 'Dan');
      if (!joined.ok) throw new Error('join failed');
      const result = await ctx.manager.removeDisconnectedPlayer(
        lobby.roomId,
        lobby.token,
        joined.playerId
      );
      expect(result).toMatchObject({ ok: false, reason: 'conflict' });
    });

    it('finished game → conflict', async () => {
      const ctx = await threePlayers();
      await ctx.store.update(ctx.roomId, (c) => ({
        ...c,
        gameState: c.gameState && { ...c.gameState, winner: ctx.seats[0].playerId },
      }));
      await silenceAllBut(ctx, [ctx.seats[0]]);
      await expectRejected(
        ctx,
        () =>
          ctx.manager.removeDisconnectedPlayer(
            ctx.roomId,
            ctx.seats[0].token,
            ctx.seats[2].playerId
          ),
        'conflict'
      );
    });

    it('unknown target → conflict', async () => {
      const ctx = await threePlayers();
      await silenceAllBut(ctx, [ctx.seats[0]]);
      await expectRejected(
        ctx,
        () => ctx.manager.removeDisconnectedPlayer(ctx.roomId, ctx.seats[0].token, 'ghost'),
        'conflict'
      );
    });

    it('removing yourself → conflict', async () => {
      const ctx = await threePlayers();
      await silenceAllBut(ctx, [ctx.seats[0]]);
      await expectRejected(
        ctx,
        () =>
          ctx.manager.removeDisconnectedPlayer(
            ctx.roomId,
            ctx.seats[0].token,
            ctx.seats[0].playerId
          ),
        'conflict'
      );
    });

    it('a connected target can never be removed', async () => {
      const ctx = await threePlayers();
      await expectRejected(
        ctx,
        () =>
          ctx.manager.removeDisconnectedPlayer(
            ctx.roomId,
            ctx.seats[0].token,
            ctx.seats[1].playerId
          ),
        'conflict',
        'Player is still connected'
      );
    });

    it('a non-host cannot remove while the host is connected', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await silenceAllBut(ctx, [alice, bob]);
      await expectRejected(
        ctx,
        () => ctx.manager.removeDisconnectedPlayer(ctx.roomId, bob.token, cara.playerId),
        'conflict',
        'Only the host can remove a player'
      );
    });

    it('a target who already went bankrupt (not in the game roster) → conflict', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await bankrupt(ctx.store, ctx.roomId, cara.playerId);
      await silenceAllBut(ctx, [alice, bob]);
      await expectRejected(
        ctx,
        () => ctx.manager.removeDisconnectedPlayer(ctx.roomId, alice.token, cara.playerId),
        'conflict'
      );
    });

    it('presence unreadable → conflict, never an assumed disconnect', async () => {
      const inner = new InMemoryPresenceStore();
      let broken = false;
      const presence: PresenceStore = {
        touch: (r, p, n) => inner.touch(r, p, n),
        getLastSeen: async (r) => {
          if (broken) throw new Error('redis down');
          return inner.getLastSeen(r);
        },
        seedIfAbsent: (r, p, n) => inner.seedIfAbsent(r, p, n),
        forget: (r, p) => inner.forget(r, p),
      };
      const ctx = await threePlayers({ presence });
      await silenceAllBut(ctx, [ctx.seats[0], ctx.seats[1]]);
      broken = true;
      await expectRejected(
        ctx,
        () =>
          ctx.manager.removeDisconnectedPlayer(
            ctx.roomId,
            ctx.seats[0].token,
            ctx.seats[2].playerId
          ),
        'conflict',
        'Player is still connected'
      );
    });
  });

  describe('host-gone fallback', () => {
    it('lets a non-host remove a disconnected host, and hands host to someone else', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await silenceAllBut(ctx, [bob, cara]);

      const result = await ctx.manager.removeDisconnectedPlayer(
        ctx.roomId,
        cara.token,
        alice.playerId
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.players.map((p) => p.id)).toEqual([bob.playerId, cara.playerId]);
      expect(result.state.players.filter((p) => p.isHost)).toHaveLength(1);
    });

    it('a bankrupt host who vanishes still opens the fallback for others', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await bankrupt(ctx.store, ctx.roomId, alice.playerId); // host: out of game, still in lobby
      await silenceAllBut(ctx, [cara]); // host AND Bob vanish

      const result = await ctx.manager.removeDisconnectedPlayer(
        ctx.roomId,
        cara.token,
        bob.playerId
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gameState?.players.map((p) => p.id)).toEqual([cara.playerId]);
    });

    it('a connected bankrupt host can still remove a vanished player', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await bankrupt(ctx.store, ctx.roomId, alice.playerId);
      await silenceAllBut(ctx, [alice, bob]);

      const result = await ctx.manager.removeDisconnectedPlayer(
        ctx.roomId,
        alice.token,
        cara.playerId
      );
      expect(result.ok).toBe(true);
    });

    it('counts the removal request itself as proof the caller is alive', async () => {
      const ctx = await threePlayers();
      const [alice, bob, cara] = ctx.seats;
      await silenceAllBut(ctx, [cara]); // Alice (host) and Bob look gone
      // Alice's own request must not leave her flagged as disconnected: she is
      // the host, so Bob stays removable only because *he* is stale.
      const result = await ctx.manager.removeDisconnectedPlayer(
        ctx.roomId,
        alice.token,
        bob.playerId
      );
      expect(result.ok).toBe(true);
      expect((await ctx.presence.getLastSeen(ctx.roomId)).get(alice.playerId)).toBe(ctx.clock.now);
      expect(START).toBeLessThan(ctx.clock.now);
    });
  });
});
