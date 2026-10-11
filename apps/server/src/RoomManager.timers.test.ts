import { describe, it, expect } from 'vitest';
import { BOARD, type GameState } from '@trade-tycoon/game-logic';
import { START, setupGame } from './test-utils/room-game';

type Ctx = Awaited<ReturnType<typeof setupGame>>;

const LIMITS = { turnLimitMs: 60_000, auctionLimitMs: 10_000 };
const MEDITERRANEAN = BOARD.findIndex((t) => t.id === 'mediterranean');

const threePlayers = (turnTimers = LIMITS) => setupGame(['Alice', 'Bob', 'Cara'], { turnTimers });

const gameOf = async (ctx: Ctx): Promise<GameState> => {
  const room = await ctx.store.get(ctx.roomId);
  if (!room?.gameState) throw new Error('no game');
  return room.gameState;
};

const versionOf = async (ctx: Ctx) => (await ctx.store.get(ctx.roomId))?.version;

/** Puts the current player (Alice) on Mediterranean Avenue in the action phase. */
const standOnMediterranean = async (ctx: Ctx) => {
  await ctx.store.update(ctx.roomId, (current) => ({
    ...current,
    gameState: current.gameState && {
      ...current.gameState,
      phase: 'action',
      players: current.gameState.players.map((p, i) =>
        i === 0 ? { ...p, position: MEDITERRANEAN } : p
      ),
    },
  }));
};

describe('turn timers: starting a game', () => {
  it('snapshots the limits into the game and starts the first turn clock', async () => {
    const ctx = await threePlayers();
    const game = await gameOf(ctx);

    expect(game.timerConfig).toEqual(LIMITS);
    expect(game.timer).toMatchObject({
      kind: 'turn',
      playerId: ctx.seats[0].playerId,
      deadline: START + LIMITS.turnLimitMs,
    });
  });

  it('starts no clock when both limits are 0', async () => {
    const ctx = await threePlayers({ turnLimitMs: 0, auctionLimitMs: 0 });
    const game = await gameOf(ctx);

    expect(game.timer ?? null).toBeNull();
    ctx.clock.now = START + 10 * 60_000;
    expect(await ctx.manager.expireIfDue(ctx.roomId)).toBeNull();
  });

  it('applies the two limits independently', async () => {
    const ctx = await threePlayers({ turnLimitMs: 0, auctionLimitMs: 10_000 });
    await standOnMediterranean(ctx);
    const [alice] = ctx.seats;

    // No turn timer, so nothing is armed on the plain turn...
    expect((await gameOf(ctx)).timer ?? null).toBeNull();

    // ...but the auction still gets its own.
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'DECLINE_BUY',
      playerId: alice.playerId,
    });
    expect((await gameOf(ctx)).timer).toMatchObject({ kind: 'auction' });
  });
});

describe('turn timers: normal play before the deadline', () => {
  it('lets an action through and keeps the turn clock running (no free extension)', async () => {
    const ctx = await threePlayers();
    const [alice] = ctx.seats;
    ctx.clock.now = START + 30_000;

    const result = await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'ROLL_DICE',
      playerId: alice.playerId,
    });

    expect(result.ok).toBe(true);
    expect((await gameOf(ctx)).timer?.deadline).toBe(START + LIMITS.turnLimitMs);
  });

  it('starts the next player a fresh clock when a turn is ended early', async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    ctx.clock.now = START + 20_000;
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'ROLL_DICE',
      playerId: alice.playerId,
    });
    // Rolling may have landed on a buyable tile; make the end unconditional.
    await ctx.store.update(ctx.roomId, (c) => ({
      ...c,
      gameState: c.gameState && { ...c.gameState, phase: 'action', doublesCount: 0 },
    }));
    await ctx.store.update(ctx.roomId, (c) => ({
      ...c,
      gameState: c.gameState && {
        ...c.gameState,
        players: c.gameState.players.map((p, i) => (i === 0 ? { ...p, position: 0 } : p)),
      },
    }));

    const ended = await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'END_TURN',
      playerId: alice.playerId,
    });

    expect(ended.ok).toBe(true);
    expect((await gameOf(ctx)).timer).toMatchObject({
      playerId: bob.playerId,
      deadline: START + 20_000 + LIMITS.turnLimitMs,
    });
  });

  it('does nothing when no deadline has passed', async () => {
    const ctx = await threePlayers();
    ctx.clock.now = START + LIMITS.turnLimitMs - 1;
    const before = await versionOf(ctx);

    expect(await ctx.manager.expireIfDue(ctx.roomId)).toBeNull();
    expect(await versionOf(ctx)).toBe(before);
  });
});

describe('turn timers: timeout', () => {
  it('skips the idle player, persists it, and gives the next player a fresh clock', async () => {
    const ctx = await threePlayers();
    const [, bob] = ctx.seats;
    ctx.clock.now = START + LIMITS.turnLimitMs + 5_000;
    const before = await versionOf(ctx);

    const expired = await ctx.manager.expireIfDue(ctx.roomId);

    expect(expired?.currentPlayerId).toBe(bob.playerId);
    expect(expired?.timer).toMatchObject({
      playerId: bob.playerId,
      deadline: ctx.clock.now + LIMITS.turnLimitMs,
      remainingMs: LIMITS.turnLimitMs,
    });
    const stored = await gameOf(ctx);
    expect(stored.currentPlayerId).toBe(bob.playerId);
    expect(stored.timer?.remainingMs).toBeUndefined(); // wire-only, never stored
    expect(await versionOf(ctx)).toBe((before ?? 0) + 1);
  });

  it('expires exactly once however often it is called', async () => {
    const ctx = await threePlayers();
    ctx.clock.now = START + LIMITS.turnLimitMs;

    const first = await ctx.manager.expireIfDue(ctx.roomId);
    const second = await ctx.manager.expireIfDue(ctx.roomId);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('rejects a late action from the timed-out player and leaves the game as the timeout made it', async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    ctx.clock.now = START + LIMITS.turnLimitMs + 1;

    const late = await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'ROLL_DICE',
      playerId: alice.playerId,
    });

    expect(late.ok).toBe(false);
    // The backstop inside the action's own update aborted with the rejection,
    // so nothing was written; the next touch settles the timeout.
    expect((await gameOf(ctx)).currentPlayerId).toBe(alice.playerId);
    const settled = await ctx.manager.expireIfDue(ctx.roomId);
    expect(settled?.currentPlayerId).toBe(bob.playerId);
    expect(settled?.players[0].position).toBe(0); // Alice never moved
    expect(settled?.logs.some((l) => l.startsWith('[Alice] Rolled'))).toBe(false);
  });

  it('judges a new action against the post-timeout game even when nobody settled it first', async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    ctx.clock.now = START + LIMITS.turnLimitMs + 1;

    const result = await ctx.manager.handleGameAction(ctx.roomId, bob.token, {
      type: 'ROLL_DICE',
      playerId: bob.playerId,
    });

    expect(result.ok).toBe(true);
    const game = await gameOf(ctx);
    expect(game.logs.some((l) => l.includes('Alice ran out of time'))).toBe(true);
    expect(game.logs.some((l) => l.startsWith('[Bob] Rolled'))).toBe(true);
    expect(game.players.find((p) => p.id === alice.playerId)?.position).toBe(0);
  });

  it('skips only one seat even if the room sat idle for far longer than a turn', async () => {
    const ctx = await threePlayers();
    const [, bob] = ctx.seats;
    ctx.clock.now = START + 100 * LIMITS.turnLimitMs;

    const expired = await ctx.manager.expireIfDue(ctx.roomId);

    expect(expired?.currentPlayerId).toBe(bob.playerId);
    expect(await ctx.manager.expireIfDue(ctx.roomId)).toBeNull();
  });
});

describe('turn timers: auctions', () => {
  it('gives each bidder a fresh, separate clock and passes an idle one', async () => {
    const ctx = await threePlayers();
    const [alice, bob, cara] = ctx.seats;
    await standOnMediterranean(ctx);
    ctx.clock.now = START + 5_000;
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'DECLINE_BUY',
      playerId: alice.playerId,
    });
    expect((await gameOf(ctx)).timer).toMatchObject({
      kind: 'auction',
      playerId: alice.playerId,
      deadline: START + 5_000 + LIMITS.auctionLimitMs,
    });

    ctx.clock.now = START + 8_000;
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'PLACE_BID',
      playerId: alice.playerId,
      amount: 20,
    });
    // The clock reset for Bob, from the bid, not from the auction's start.
    expect((await gameOf(ctx)).timer).toMatchObject({
      playerId: bob.playerId,
      deadline: START + 8_000 + LIMITS.auctionLimitMs,
    });

    ctx.clock.now = START + 8_000 + LIMITS.auctionLimitMs;
    const expired = await ctx.manager.expireIfDue(ctx.roomId);

    expect(expired?.auction?.participants).toEqual([alice.playerId, cara.playerId]);
    expect(expired?.timer).toMatchObject({
      kind: 'auction',
      playerId: cara.playerId,
      deadline: ctx.clock.now + LIMITS.auctionLimitMs,
    });
  });

  it('awards the property to the high bidder when the last rival times out, then restarts the turn clock', async () => {
    const ctx = await setupGame(['Alice', 'Bob'], { turnTimers: LIMITS });
    const [alice] = ctx.seats;
    await standOnMediterranean(ctx);
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'DECLINE_BUY',
      playerId: alice.playerId,
    });
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'PLACE_BID',
      playerId: alice.playerId,
      amount: 30,
    });
    ctx.clock.now = START + LIMITS.auctionLimitMs;

    const expired = await ctx.manager.expireIfDue(ctx.roomId);

    expect(expired?.auction).toBeNull();
    expect(expired?.players[0].properties).toContain('mediterranean');
    expect(expired?.players[0].money).toBe(1470);
    expect(expired?.timer).toMatchObject({
      kind: 'turn',
      playerId: alice.playerId,
      deadline: ctx.clock.now + LIMITS.turnLimitMs,
    });
  });

  it("rejects a bid that arrives after the bidder's deadline", async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    await standOnMediterranean(ctx);
    await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'DECLINE_BUY',
      playerId: alice.playerId,
    });
    ctx.clock.now = START + LIMITS.auctionLimitMs + 1;

    const late = await ctx.manager.handleGameAction(ctx.roomId, alice.token, {
      type: 'PLACE_BID',
      playerId: alice.playerId,
      amount: 50,
    });

    expect(late.ok).toBe(false);
    const settled = await ctx.manager.expireIfDue(ctx.roomId);
    expect(settled?.auction?.currentBid).toBe(0);
    expect(settled?.auction?.participants).not.toContain(alice.playerId);
    expect(settled?.timer?.playerId).toBe(bob.playerId);
  });
});

describe('turn timers: reconnect, leaving and disconnects', () => {
  it('shows a client that reconnects mid-turn only the time that is left', async () => {
    const ctx = await threePlayers();
    const [, bob] = ctx.seats;
    ctx.clock.now = START + 45_000;

    const result = await ctx.manager.reconnect(ctx.roomId, bob.token);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gameState?.timer?.remainingMs).toBe(15_000);
    expect(result.state.gameState?.timer?.remainingMs).toBe(15_000);
  });

  it('keeps the clock running for a disconnected player, so their turn is skipped', async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    ctx.clock.now = START + LIMITS.turnLimitMs + 100_000; // long past presence timeout too

    const expired = await ctx.manager.expireIfDue(ctx.roomId);

    expect(expired?.currentPlayerId).toBe(bob.playerId);
    expect(expired?.players.some((p) => p.id === alice.playerId)).toBe(true); // still seated
  });

  it('re-arms the clock for the next player when the current player leaves', async () => {
    const ctx = await threePlayers();
    const [alice, bob] = ctx.seats;
    ctx.clock.now = START + 40_000;

    const left = await ctx.manager.leaveRoom(ctx.roomId, alice.token);

    expect(left.ok).toBe(true);
    expect((await gameOf(ctx)).timer).toMatchObject({
      playerId: bob.playerId,
      deadline: START + 40_000 + LIMITS.turnLimitMs,
    });
  });

  it('clears the clock when the game is won', async () => {
    const ctx = await setupGame(['Alice', 'Bob'], { turnTimers: LIMITS });
    const [alice, bob] = ctx.seats;

    await ctx.manager.leaveRoom(ctx.roomId, bob.token);

    const game = await gameOf(ctx);
    expect(game.winner).toBe(alice.playerId);
    expect(game.timer ?? null).toBeNull();
    ctx.clock.now = START + 10 * LIMITS.turnLimitMs;
    expect(await ctx.manager.expireIfDue(ctx.roomId)).toBeNull();
  });
});
