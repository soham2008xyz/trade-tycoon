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

      const res = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' });

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
      const res = await request(app)
        .post('/api/rooms/NONEXIST/join')
        .send({ playerName: 'Bob' });
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
      const res = await request(app)
        .post(`/api/rooms/${lower}/join`)
        .send({ playerName: 'Bob' });
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
      const join = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' });
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

    it('returns 404 with session_expired for a stale userId', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/reconnect`)
        .send({ userId: 'stale-user-id' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('session_expired');
    });
  });
});
