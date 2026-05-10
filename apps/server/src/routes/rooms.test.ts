import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import type { RoomEvent } from '../events/EventBus';
import { createRoomsRouter } from './rooms';

const buildApp = () => {
  const roomManager = new RoomManager(new InMemoryRoomStore());
  const eventBus = new InMemoryEventBus();
  const app: Express = express();
  app.use(express.json());
  app.use(createRoomsRouter({ roomManager, eventBus }));
  return { app, roomManager, eventBus };
};

describe('REST: /api/rooms', () => {
  let app: Express;
  let roomManager: RoomManager;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    ({ app, roomManager, eventBus } = buildApp());
  });

  describe('POST /api/rooms', () => {
    it('creates a room and returns 201 with host credentials', async () => {
      const res = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      expect(res.status).toBe(201);
      expect(res.body.roomId).toMatch(/^[A-Z0-9]{8}$/);
      expect(res.body.userId).toBeTruthy();
      expect(res.body.isHost).toBe(true);

      const room = await roomManager.getRoom(res.body.roomId);
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].name).toBe('Alice');
    });

    it('rejects an empty player name with 400', async () => {
      const res = await request(app).post('/api/rooms').send({ playerName: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    it('lets a second player join an existing room and publishes a lobby_update', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId } = create.body;

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      const res = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });

      expect(res.status).toBe(200);
      expect(res.body.userId).toBeTruthy();
      expect(res.body.isHost).toBe(false);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('lobby_update');
      // The published event carries the post-join state with both players.
      const lobby = events[0].state as { players: { name: string }[] };
      expect(lobby.players.map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('returns 404 for a room that does not exist', async () => {
      const res = await request(app).post('/api/rooms/NONEXIST/join').send({ playerName: 'Bob' });
      expect(res.status).toBe(404);
    });

    it('returns 409 once the game has started', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Charlie' });
      expect(res.status).toBe(409);
    });

    it('lower-case room codes resolve to the canonical uppercase room', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const lower = (create.body.roomId as string).toLowerCase();
      const res = await request(app).post(`/api/rooms/${lower}/join`).send({ playerName: 'Bob' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/rooms/:id/start', () => {
    it('returns 409 if only one player is in the lobby', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/start`)
        .send({ userId: create.body.userId });
      expect(res.status).toBe(409);
    });

    it('returns 409 if a non-host tries to start', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const join = await request(app)
        .post(`/api/rooms/${create.body.roomId}/join`)
        .send({ playerName: 'Bob' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/start`)
        .send({ userId: join.body.userId });
      expect(res.status).toBe(409);
    });

    it('starts the game and publishes a game_state_update + lobby_update', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      const res = await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });
      expect(res.status).toBe(200);

      expect(events.map((e) => e.type)).toEqual(['game_state_update', 'lobby_update']);
      const room = await roomManager.getRoom(roomId);
      expect(room?.status).toBe('game');
    });
  });

  describe('POST /api/rooms/:id/actions', () => {
    it('returns 404 for an unknown room', async () => {
      const res = await request(app)
        .post('/api/rooms/UNKNOWN/actions')
        .send({ userId: 'x', action: { type: 'ROLL_DICE', playerId: 'x' } });
      expect(res.status).toBe(404);
    });

    it('returns 409 when the game has not started', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/actions`)
        .send({
          userId: create.body.userId,
          action: { type: 'ROLL_DICE', playerId: create.body.userId },
        });
      expect(res.status).toBe(409);
    });

    it('applies a valid action and publishes game_state_update', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: hostId, action: { type: 'ROLL_DICE', playerId: hostId } });
      expect(res.status).toBe(200);
      expect(events.some((e) => e.type === 'game_state_update')).toBe(true);
    });

    it('returns 409 when a player tries to roll for someone else (server enforces playerId match)', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.userId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        // Bob tries to act AS Alice
        .send({ userId: bobId, action: { type: 'ROLL_DICE', playerId: hostId } });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/rooms/:id/reconnect', () => {
    it('returns 200 with lobby state for a known user', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId } = create.body;
      const res = await request(app).post(`/api/rooms/${roomId}/reconnect`).send({ userId });
      expect(res.status).toBe(200);
      expect(res.body.lobby.roomId).toBe(roomId);
      expect(res.body.gameState).toBeNull();
    });

    it('returns 200 with both lobby and gameState once the game has started', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/reconnect`)
        .send({ userId: hostId });
      expect(res.status).toBe(200);
      expect(res.body.lobby.status).toBe('game');
      expect(res.body.gameState).toBeTruthy();
      expect(res.body.gameState.players).toHaveLength(2);
      // Resume must not leak the precomputed board (game-logic strips it)
      expect(res.body.gameState.board).toBeUndefined();
    });

    it('returns 200 for a non-host who reconnects to a started game', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: hostId } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.userId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: hostId });

      const res = await request(app).post(`/api/rooms/${roomId}/reconnect`).send({ userId: bobId });
      expect(res.status).toBe(200);
      expect(res.body.lobby.status).toBe('game');
      expect(res.body.gameState).toBeTruthy();
    });

    it('returns 404 with session_expired for a stale userId', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/reconnect`)
        .send({ userId: 'stale-user-id' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('session_expired');
    });
  });

  /**
   * Trade flow integration tests. The client UI hides Accept/Reject from
   * non-targets and Cancel from non-initiators (`canAcceptTrade` /
   * `canCancelTrade` in `multiplayer-gating.ts`); these tests pin down the
   * server-side enforcement so the same boundaries hold even if a malicious
   * client bypassed the UI.
   *
   * Setup helper: starts a 2-player game, has Alice land on Mediterranean
   * (the first buyable tile after Go) by mocking dice, has her buy it, then
   * proposes a trade from Alice to Bob offering nothing for nothing.
   */
  describe('trade action boundaries (server enforcement)', () => {
    const setupActiveTrade = async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: aliceId } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.userId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: aliceId });

      // Propose a trivial trade so we have an `activeTrade` to act on. Whether
      // the offer makes sense doesn't matter for boundary-checking; we just
      // need the trade in flight.
      await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          userId: aliceId,
          action: {
            type: 'PROPOSE_TRADE',
            playerId: aliceId,
            targetPlayerId: bobId,
            offer: { money: 0, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
          },
        });

      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade).toBeTruthy();
      return { roomId, aliceId, bobId, tradeId: room!.gameState!.activeTrade!.id };
    };

    it('lets the target accept the trade', async () => {
      const { roomId, bobId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: bobId, action: { type: 'ACCEPT_TRADE', playerId: bobId } });
      expect(res.status).toBe(200);
      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade).toBeNull();
    });

    it('lets the initiator cancel the trade', async () => {
      const { roomId, aliceId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: aliceId, action: { type: 'CANCEL_TRADE', playerId: aliceId } });
      expect(res.status).toBe(200);
      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade).toBeNull();
    });

    it('returns 409 when a third party tries to accept the trade', async () => {
      // 3-player setup so we have a non-target third party.
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, userId: aliceId } = create.body;
      const joinBob = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' });
      const bobId = joinBob.body.userId;
      const joinCharlie = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Charlie' });
      const charlieId = joinCharlie.body.userId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ userId: aliceId });

      await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          userId: aliceId,
          action: {
            type: 'PROPOSE_TRADE',
            playerId: aliceId,
            targetPlayerId: bobId,
            offer: { money: 0, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
          },
        });

      const before = await roomManager.getRoom(roomId);
      const tradeIdBefore = before?.gameState?.activeTrade?.id;
      expect(tradeIdBefore).toBeTruthy();

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: charlieId, action: { type: 'ACCEPT_TRADE', playerId: charlieId } });
      expect(res.status).toBe(409);

      const after = await roomManager.getRoom(roomId);
      expect(after?.gameState?.activeTrade?.id).toBe(tradeIdBefore);
    });

    it('returns 409 when a non-initiator tries to cancel the trade', async () => {
      const { roomId, bobId, tradeId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: bobId, action: { type: 'CANCEL_TRADE', playerId: bobId } });
      expect(res.status).toBe(409);

      const after = await roomManager.getRoom(roomId);
      expect(after?.gameState?.activeTrade?.id).toBe(tradeId);
    });

    it('rejects a player trying to attribute a trade action to someone else', async () => {
      // The userId === action.playerId guard. Bob is the legitimate target,
      // but he sends the action with playerId set to Alice. Server's first
      // check (handleGameAction) catches the impersonation before the
      // reducer even sees it.
      const { roomId, aliceId, bobId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ userId: bobId, action: { type: 'ACCEPT_TRADE', playerId: aliceId } });
      expect(res.status).toBe(409);
    });
  });
});
