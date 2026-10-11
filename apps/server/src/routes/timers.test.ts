import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { BOARD, type GameState } from '@trade-tycoon/game-logic';
import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import type { RoomEvent } from '../events/EventBus';
import { createRoomsRouter } from './rooms';
import { createEventsRouter } from './events';

const LIMITS = { turnLimitMs: 60_000, auctionLimitMs: 10_000 };

/** A started 2-player room on a controllable clock, behind the real routers. */
const build = async (turnTimers = LIMITS, extraPlayers: string[] = []) => {
  const clock = { now: 2_000_000 };
  const store = new InMemoryRoomStore();
  const roomManager = new RoomManager(store, {
    clock: () => clock.now,
    turnTimers,
  });
  const eventBus = new InMemoryEventBus();
  const app = express();
  app.use(express.json());
  app.use(createRoomsRouter({ roomManager, eventBus }));
  app.use(createEventsRouter({ roomManager, eventBus }));

  const created = await roomManager.createRoom('Alice');
  const joined = await roomManager.joinRoom(created.roomId, 'Bob');
  if (!joined.ok) throw new Error('join failed');
  const extras = [];
  for (const name of extraPlayers) {
    const extra = await roomManager.joinRoom(created.roomId, name);
    if (!extra.ok) throw new Error('join failed');
    extras.push({ playerId: extra.playerId, token: extra.token });
  }
  await roomManager.startGame(created.roomId, created.token);
  return {
    store,
    extras,
    app,
    clock,
    roomManager,
    eventBus,
    roomId: created.roomId,
    alice: { playerId: created.playerId, token: created.token },
    bob: { playerId: joined.playerId, token: joined.token },
  };
};

const gameUpdates = (events: RoomEvent[]): GameState[] =>
  events.flatMap((e) => (e.type === 'game_state_update' ? [e.state] : []));

describe('turn timers over REST', () => {
  it('answers a late action with 409, yet still broadcasts the timeout it caused', async () => {
    const { app, clock, eventBus, roomId, alice, bob } = await build();
    const events: RoomEvent[] = [];
    await eventBus.subscribe(roomId, (e) => events.push(e));
    clock.now += LIMITS.turnLimitMs + 1;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/actions`)
      .send({ token: alice.token, action: { type: 'ROLL_DICE', playerId: alice.playerId } });

    expect(res.status).toBe(409);
    const updates = gameUpdates(events);
    expect(updates).toHaveLength(1);
    expect(updates[0].currentPlayerId).toBe(bob.playerId);
    expect(updates[0].timer?.remainingMs).toBe(LIMITS.turnLimitMs);
  });

  it('lets an in-time action through with 200 and broadcasts it', async () => {
    const { app, clock, eventBus, roomId, alice } = await build();
    const events: RoomEvent[] = [];
    await eventBus.subscribe(roomId, (e) => events.push(e));
    clock.now += LIMITS.turnLimitMs - 1;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/actions`)
      .send({ token: alice.token, action: { type: 'ROLL_DICE', playerId: alice.playerId } });

    expect(res.status).toBe(200);
    expect(gameUpdates(events)).toHaveLength(1);
    expect(gameUpdates(events)[0].currentPlayerId).toBe(alice.playerId);
  });

  it('settles and broadcasts an expiry when a native client polls /reconnect', async () => {
    const { app, clock, eventBus, roomId, alice, bob } = await build();
    const events: RoomEvent[] = [];
    await eventBus.subscribe(roomId, (e) => events.push(e));
    clock.now += LIMITS.turnLimitMs + 2_000;

    const res = await request(app)
      .post(`/api/rooms/${roomId}/reconnect`)
      .send({ token: alice.token });

    expect(res.status).toBe(200);
    expect(res.body.gameState.currentPlayerId).toBe(bob.playerId);
    expect(res.body.gameState.timer.remainingMs).toBe(LIMITS.turnLimitMs);
    expect(res.body.lobby.gameState.timer.remainingMs).toBe(LIMITS.turnLimitMs);
    expect(gameUpdates(events)).toHaveLength(1);
  });

  it('reports the same remaining time to every client at the same instant', async () => {
    const { app, clock, roomId, alice, bob } = await build();
    clock.now += 12_000;

    const [a, b] = await Promise.all([
      request(app).post(`/api/rooms/${roomId}/reconnect`).send({ token: alice.token }),
      request(app).post(`/api/rooms/${roomId}/reconnect`).send({ token: bob.token }),
    ]);

    expect(a.body.gameState.timer.remainingMs).toBe(48_000);
    expect(b.body.gameState.timer).toEqual(a.body.gameState.timer);
  });
});

describe('turn timers when a player leaves or is removed', () => {
  const MEDITERRANEAN = BOARD.findIndex((t) => t.id === 'mediterranean');

  /** Alice declines Mediterranean, so a 3-way auction opens with Alice to bid. */
  const overdueAuction = async () => {
    const ctx = await build(LIMITS, ['Cara']);
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
    await ctx.roomManager.handleGameAction(ctx.roomId, ctx.alice.token, {
      type: 'DECLINE_BUY',
      playerId: ctx.alice.playerId,
    });
    ctx.clock.now += LIMITS.auctionLimitMs + 1; // Alice's bid clock has run out
    return ctx;
  };

  it('passes the overdue bidder first instead of re-arming their clock when someone else leaves', async () => {
    const ctx = await overdueAuction();
    const [cara] = ctx.extras;
    const events: RoomEvent[] = [];
    await ctx.eventBus.subscribe(ctx.roomId, (e) => events.push(e));

    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/leave`)
      .send({ token: cara.token });

    expect(res.status).toBe(200);
    const game = (await ctx.roomManager.getRoom(ctx.roomId))?.gameState;
    expect(game?.auction?.participants).toEqual([ctx.bob.playerId]);
    // Alice's pass was broadcast, then Cara's departure.
    expect(events.map((e) => e.type)).toEqual(['game_state_update', 'lobby_update']);
  });

  it('does the same when a disconnected player is removed', async () => {
    const ctx = await overdueAuction();
    const [cara] = ctx.extras;
    // Cara has been silent past the presence timeout; everyone else is live.
    ctx.clock.now += 60_000;
    await ctx.roomManager.recordSeen(ctx.roomId, ctx.alice.playerId);
    await ctx.roomManager.recordSeen(ctx.roomId, ctx.bob.playerId);

    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/remove-player`)
      .send({ token: ctx.alice.token, targetPlayerId: cara.playerId });

    expect(res.status).toBe(200);
    const game = (await ctx.roomManager.getRoom(ctx.roomId))?.gameState;
    expect(game?.auction?.participants ?? []).not.toContain(ctx.alice.playerId);
  });
});

describe('turn timers over SSE', () => {
  let server: Server | undefined;
  afterEach(async () => {
    if (server) await new Promise<void>((res) => server!.close(() => res()));
    server = undefined;
  });

  it('pushes the timeout to an open stream when the deadline passes, with no request from anyone', async () => {
    // Real clock here: the stream's own timeout is what must fire.
    const roomManager = new RoomManager(new InMemoryRoomStore(), {
      turnTimers: { turnLimitMs: 150, auctionLimitMs: 150 },
    });
    const eventBus = new InMemoryEventBus();
    const app = express();
    app.use(express.json());
    app.use(createRoomsRouter({ roomManager, eventBus }));
    app.use(createEventsRouter({ roomManager, eventBus }));
    server = createServer(app);
    await new Promise<void>((res) => server!.listen(0, res));
    const port = (server.address() as AddressInfo).port;

    const created = await roomManager.createRoom('Alice');
    const joined = await roomManager.joinRoom(created.roomId, 'Bob');
    if (!joined.ok) throw new Error('join failed');
    await roomManager.startGame(created.roomId, created.token);

    const res = await fetch(
      `http://localhost:${port}/api/rooms/${created.roomId}/events?token=${created.token}`
    );
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    const deadline = Date.now() + 3000;
    let skippedTo: string | undefined;
    while (Date.now() < deadline && !skippedTo) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value);
      for (const frame of buffer.split('\n\n')) {
        const data = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!frame.startsWith('event: game_state_update') || !data) continue;
        const state = JSON.parse(data.slice(5)) as GameState;
        if (state.currentPlayerId === joined.playerId) skippedTo = state.currentPlayerId;
      }
    }
    await reader.cancel();

    expect(skippedTo).toBe(joined.playerId);
  });
});
