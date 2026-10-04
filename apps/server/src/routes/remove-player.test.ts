import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import type { RoomEvent } from '../events/EventBus';
import { createRoomsRouter } from './rooms';
import { setupGame, silenceAllBut } from '../test-utils/room-game';

/** A started 3-player game mounted behind the real router, on a fake clock. */
const build = async () => {
  const ctx = await setupGame(['Alice', 'Bob', 'Cara']);
  const eventBus = new InMemoryEventBus();
  const app = express();
  app.use(express.json());
  app.use(createRoomsRouter({ roomManager: ctx.manager, eventBus }));
  const events: RoomEvent[] = [];
  await eventBus.subscribe(ctx.roomId, (e) => events.push(e));
  return { ...ctx, app, events };
};

describe('POST /api/rooms/:id/remove-player', () => {
  it('400s without a token or a target', async () => {
    const { app, roomId, seats } = await build();
    const noToken = await request(app)
      .post(`/api/rooms/${roomId}/remove-player`)
      .send({ targetPlayerId: seats[2].playerId });
    expect(noToken.status).toBe(400);
    const noTarget = await request(app)
      .post(`/api/rooms/${roomId}/remove-player`)
      .send({ token: seats[0].token });
    expect(noTarget.status).toBe(400);
  });

  it('401s on an unknown token and publishes nothing', async () => {
    const ctx = await build();
    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/remove-player`)
      .send({ token: 'stranger', targetPlayerId: ctx.seats[2].playerId });
    expect(res.status).toBe(401);
    expect(ctx.events).toHaveLength(0);
  });

  it('404s for an unknown room', async () => {
    const ctx = await build();
    const res = await request(ctx.app)
      .post('/api/rooms/NOROOM00/remove-player')
      .send({ token: ctx.seats[0].token, targetPlayerId: ctx.seats[2].playerId });
    expect(res.status).toBe(404);
  });

  it('409s for a connected target with the reason, and publishes nothing', async () => {
    const ctx = await build();
    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/remove-player`)
      .send({ token: ctx.seats[0].token, targetPlayerId: ctx.seats[2].playerId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Player is still connected');
    expect(ctx.events).toHaveLength(0);
  });

  it('409s for a non-host while the host is connected', async () => {
    const ctx = await build();
    const [alice, bob, cara] = ctx.seats;
    await silenceAllBut(ctx, [alice, bob]);
    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/remove-player`)
      .send({ token: bob.token, targetPlayerId: cara.playerId });
    expect(res.status).toBe(409);
    expect(ctx.events).toHaveLength(0);
  });

  it('removes a disconnected player and publishes exactly one lobby_update', async () => {
    const ctx = await build();
    const [alice, bob, cara] = ctx.seats;
    await silenceAllBut(ctx, [alice, bob]);

    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/remove-player`)
      .send({ token: alice.token, targetPlayerId: cara.playerId });

    expect(res.status).toBe(200);
    expect(ctx.events).toHaveLength(1);
    const [event] = ctx.events;
    expect(event.type).toBe('lobby_update');
    if (event.type !== 'lobby_update') return;
    expect(event.state.players.map((p) => p.id)).toEqual([alice.playerId, bob.playerId]);
    expect(event.state.gameState?.players.map((p) => p.id)).toEqual([alice.playerId, bob.playerId]);
    expect((event.state as { sessions?: unknown }).sessions).toBeUndefined();

    const back = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/reconnect`)
      .send({ token: cara.token });
    expect(back.status).toBe(404);
    expect(back.body.error).toBe('session_expired');
  });
});

describe('POST /api/rooms/:id/reconnect presence', () => {
  it('reports disconnectedPlayerIds and counts the poll as a heartbeat', async () => {
    const ctx = await build();
    const [alice, bob, cara] = ctx.seats;
    await silenceAllBut(ctx, [alice, bob]);

    const res = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/reconnect`)
      .send({ token: alice.token });
    expect(res.status).toBe(200);
    expect(res.body.disconnectedPlayerIds).toEqual([cara.playerId]);

    // Cara polls: she clears on the very next read.
    await request(ctx.app).post(`/api/rooms/${ctx.roomId}/reconnect`).send({ token: cara.token });
    const again = await request(ctx.app)
      .post(`/api/rooms/${ctx.roomId}/reconnect`)
      .send({ token: alice.token });
    expect(again.body.disconnectedPlayerIds).toEqual([]);
  });

  it('is empty in a lobby with no game', async () => {
    const ctx = await build();
    const lobby = await ctx.manager.createRoom('Solo');
    const res = await request(ctx.app)
      .post(`/api/rooms/${lobby.roomId}/reconnect`)
      .send({ token: lobby.token });
    expect(res.body.disconnectedPlayerIds).toEqual([]);
  });
});
