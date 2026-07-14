import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import { StoreConflictError } from '../store/RoomStore';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import { errorHandler } from '../middleware/errors';
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
      expect(res.body.playerId).toBeTruthy();
      expect(res.body.token).toBeTruthy();
      expect(res.body.token).not.toBe(res.body.playerId);
      expect(res.body.isHost).toBe(true);

      const room = await roomManager.getRoom(res.body.roomId);
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].name).toBe('Alice');
    });

    it('rejects an empty player name with 400', async () => {
      const res = await request(app).post('/api/rooms').send({ playerName: '' });
      expect(res.status).toBe(400);
    });

    it('never includes the sessions map in the response or a publish', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId } = create.body;
      expect(create.body.sessions).toBeUndefined();

      // Subscribe before the next mutation so we can observe its publish —
      // subscribing after create() would miss create's own publish entirely.
      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });

      expect(events).toHaveLength(1);
      expect((events[0].state as { sessions?: unknown }).sessions).toBeUndefined();

      const room = await roomManager.getRoom(roomId);
      expect((room as unknown as { sessions?: unknown })?.sessions).toBeUndefined();
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
      expect(res.body.playerId).toBeTruthy();
      expect(res.body.token).toBeTruthy();
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
      const { roomId, token: hostToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

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
        .send({ token: create.body.token });
      expect(res.status).toBe(409);
    });

    it('returns 409 if a non-host tries to start', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const join = await request(app)
        .post(`/api/rooms/${create.body.roomId}/join`)
        .send({ playerName: 'Bob' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/start`)
        .send({ token: join.body.token });
      expect(res.status).toBe(409);
    });

    it('starts the game and publishes a single lobby_update carrying the new gameState', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, token: hostToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      const res = await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });
      expect(res.status).toBe(200);

      expect(events.map((e) => e.type)).toEqual(['lobby_update']);
      const lobbyEvent = events[0];
      if (lobbyEvent.type !== 'lobby_update') throw new Error('Expected lobby_update');
      expect(lobbyEvent.state.status).toBe('game');
      expect(lobbyEvent.state.gameState?.players).toHaveLength(2);

      const room = await roomManager.getRoom(roomId);
      expect(room?.status).toBe('game');
    });
  });

  describe('POST /api/rooms/:id/actions', () => {
    it('returns 404 for an unknown room', async () => {
      const res = await request(app)
        .post('/api/rooms/UNKNOWN/actions')
        .send({ token: 'x', action: { type: 'ROLL_DICE', playerId: 'x' } });
      expect(res.status).toBe(404);
    });

    it('returns 409 when the game has not started', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/actions`)
        .send({
          token: create.body.token,
          action: { type: 'ROLL_DICE', playerId: create.body.playerId },
        });
      expect(res.status).toBe(409);
    });

    it('does not publish a game_state_update when an action is rejected', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, token: aliceToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.playerId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      // It's Alice's turn — Bob rolling is a pure no-op rejection.
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: join.body.token, action: { type: 'ROLL_DICE', playerId: bobId } });

      expect(res.status).toBe(409);
      expect(events).toHaveLength(0);
    });

    it('returns 400 when the action is missing or malformed', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/actions`)
        .send({ token: create.body.token, action: { type: 'NOT_A_REAL_ACTION' } });
      expect(res.status).toBe(400);
    });

    it('rejects a negative trade offer amount at the boundary', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.playerId;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: aliceToken,
          action: {
            type: 'PROPOSE_TRADE',
            playerId: aliceId,
            targetPlayerId: bobId,
            offer: { money: -5000, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
          },
        });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric bid amount at the boundary', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: aliceToken,
          action: { type: 'PLACE_BID', playerId: aliceId, amount: 'abc' },
        });
      expect(res.status).toBe(400);
    });

    it('applies a valid action and publishes game_state_update', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: hostId, token: hostToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (e) => events.push(e));

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: hostToken, action: { type: 'ROLL_DICE', playerId: hostId } });
      expect(res.status).toBe(200);
      expect(events.some((e) => e.type === 'game_state_update')).toBe(true);
    });

    it('returns 409 when a player tries to roll for someone else using their own token', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: hostId, token: hostToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobToken = join.body.token;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        // Bob's own (valid) token, but the action claims to be Alice.
        .send({ token: bobToken, action: { type: 'ROLL_DICE', playerId: hostId } });
      expect(res.status).toBe(409);
    });

    it('returns 401 when acting with a stolen public playerId as the token', async () => {
      // Regression test for the impersonation vulnerability: knowing another
      // player's public id (visible in every broadcast) must not be usable
      // as a credential.
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: hostToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        // Using Alice's PUBLIC id as if it were her token.
        .send({ token: aliceId, action: { type: 'ROLL_DICE', playerId: aliceId } });
      expect(res.status).toBe(401);
    });
  });

  describe('store contention', () => {
    it('returns 503 when the store exhausts its CAS retries', async () => {
      // Standalone app wiring: the shared buildApp hides its store, and this
      // test needs both a store handle to force the conflict and the error
      // middleware registered the way index.ts registers it (last).
      const store = new InMemoryRoomStore();
      const contendedManager = new RoomManager(store);
      const contendedApp: Express = express();
      contendedApp.use(express.json());
      contendedApp.use(
        createRoomsRouter({ roomManager: contendedManager, eventBus: new InMemoryEventBus() })
      );
      contendedApp.use(errorHandler);

      const create = await request(contendedApp).post('/api/rooms').send({ playerName: 'Alice' });

      vi.spyOn(store, 'update').mockRejectedValue(new StoreConflictError(create.body.roomId));

      const res = await request(contendedApp)
        .post(`/api/rooms/${create.body.roomId}/join`)
        .send({ playerName: 'Bob' });

      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/retry/i);
    });
  });

  describe('POST /api/rooms/:id/reconnect', () => {
    it('returns 200 with lobby state for a known token', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, token } = create.body;
      const res = await request(app).post(`/api/rooms/${roomId}/reconnect`).send({ token });
      expect(res.status).toBe(200);
      expect(res.body.lobby.roomId).toBe(roomId);
      expect(res.body.gameState).toBeNull();
    });

    it('returns 200 with both lobby and gameState once the game has started', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, token: hostToken } = create.body;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/reconnect`)
        .send({ token: hostToken });
      expect(res.status).toBe(200);
      expect(res.body.lobby.status).toBe('game');
      expect(res.body.gameState).toBeTruthy();
      expect(res.body.gameState.players).toHaveLength(2);
      // Resume must not leak the precomputed board (game-logic strips it)
      expect(res.body.gameState.board).toBeUndefined();
      expect(res.body.lobby.gameState.board).toBeUndefined();
    });

    it('returns 200 for a non-host who reconnects to a started game', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, token: hostToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobToken = join.body.token;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: hostToken });

      const res = await request(app)
        .post(`/api/rooms/${roomId}/reconnect`)
        .send({ token: bobToken });
      expect(res.status).toBe(200);
      expect(res.body.lobby.status).toBe('game');
      expect(res.body.gameState).toBeTruthy();
    });

    it('returns 404 with session_expired for a stale token', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/reconnect`)
        .send({ token: 'stale-token' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('session_expired');
    });
  });

  describe('POST /api/rooms/:id/leave', () => {
    it('returns 404 with session_expired for a stale token', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });

      const res = await request(app)
        .post(`/api/rooms/${create.body.roomId}/leave`)
        .send({ token: 'stale-token' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('session_expired');
    });

    it('removes a lobby player and publishes a lobby_update', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobToken = join.body.token;

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (event) => events.push(event));

      const res = await request(app).post(`/api/rooms/${roomId}/leave`).send({ token: bobToken });

      expect(res.status).toBe(200);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('lobby_update');
      expect(events[0].state.players.map((player) => player.name)).toEqual(['Alice']);
    });

    it('removes an in-game player and publishes a single lobby_update carrying the new gameState', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobToken = join.body.token;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (event) => events.push(event));

      const res = await request(app).post(`/api/rooms/${roomId}/leave`).send({ token: bobToken });

      expect(res.status).toBe(200);
      expect(events.map((event) => event.type)).toEqual(['lobby_update']);
      const lobbyUpdate = events[0];
      if (lobbyUpdate.type !== 'lobby_update') throw new Error('Expected lobby_update');
      expect(lobbyUpdate.state.gameState?.players).toHaveLength(1);
      expect(lobbyUpdate.state.gameState?.players[0].id).toBe(aliceId);
      expect(lobbyUpdate.state.gameState?.winner).toBe(aliceId);
    });

    it('clears an active trade when a trade participant leaves mid-game', async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.playerId;
      const bobToken = join.body.token;
      await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Charlie' });
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: aliceToken,
          action: {
            type: 'PROPOSE_TRADE',
            playerId: aliceId,
            targetPlayerId: bobId,
            offer: { money: 0, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
          },
        });

      const events: RoomEvent[] = [];
      await eventBus.subscribe(roomId, (event) => events.push(event));

      const res = await request(app).post(`/api/rooms/${roomId}/leave`).send({ token: bobToken });

      expect(res.status).toBe(200);
      expect(events.map((event) => event.type)).toEqual(['lobby_update']);
      const lobbyUpdate = events[0];
      if (lobbyUpdate.type !== 'lobby_update') throw new Error('Expected lobby_update');
      expect(lobbyUpdate.state.gameState?.activeTrade).toBeNull();
      expect(lobbyUpdate.state.gameState?.toastMessage).toContain('Active trade cancelled.');
      expect(lobbyUpdate.state.gameState?.players).toHaveLength(2);
    });
  });

  /**
   * Trade flow integration tests. The client UI hides Accept/Reject from
   * non-targets and Cancel from non-initiators (`canAcceptTrade` /
   * `canCancelTrade` in `multiplayer-gating.ts`); these tests pin down the
   * server-side enforcement so the same boundaries hold even if a malicious
   * client bypassed the UI.
   *
   * Setup helper: starts a 2-player game and proposes a trade from Alice to
   * Bob offering nothing for nothing, so we have an `activeTrade` to act on.
   */
  describe('trade action boundaries (server enforcement)', () => {
    const setupActiveTrade = async () => {
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      const join = await request(app).post(`/api/rooms/${roomId}/join`).send({ playerName: 'Bob' });
      const bobId = join.body.playerId;
      const bobToken = join.body.token;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: aliceToken,
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
      return {
        roomId,
        aliceId,
        aliceToken,
        bobId,
        bobToken,
        tradeId: room!.gameState!.activeTrade!.id,
      };
    };

    it('lets the target accept the trade', async () => {
      const { roomId, bobId, bobToken } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: bobToken, action: { type: 'ACCEPT_TRADE', playerId: bobId } });
      expect(res.status).toBe(200);
      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade).toBeNull();
    });

    it('lets the initiator cancel the trade', async () => {
      const { roomId, aliceId, aliceToken } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: aliceToken, action: { type: 'CANCEL_TRADE', playerId: aliceId } });
      expect(res.status).toBe(200);
      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade).toBeNull();
    });

    it('returns 409 when a third party tries to accept the trade', async () => {
      // 3-player setup so we have a non-target third party.
      const create = await request(app).post('/api/rooms').send({ playerName: 'Alice' });
      const { roomId, playerId: aliceId, token: aliceToken } = create.body;
      const joinBob = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' });
      const bobId = joinBob.body.playerId;
      const joinCharlie = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .send({ playerName: 'Charlie' });
      const charlieId = joinCharlie.body.playerId;
      const charlieToken = joinCharlie.body.token;
      await request(app).post(`/api/rooms/${roomId}/start`).send({ token: aliceToken });

      await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: aliceToken,
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
        .send({ token: charlieToken, action: { type: 'ACCEPT_TRADE', playerId: charlieId } });
      expect(res.status).toBe(409);

      const after = await roomManager.getRoom(roomId);
      expect(after?.gameState?.activeTrade?.id).toBe(tradeIdBefore);
    });

    it('returns 409 when a non-initiator tries to cancel the trade', async () => {
      const { roomId, bobId, bobToken, tradeId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: bobToken, action: { type: 'CANCEL_TRADE', playerId: bobId } });
      expect(res.status).toBe(409);

      const after = await roomManager.getRoom(roomId);
      expect(after?.gameState?.activeTrade?.id).toBe(tradeId);
    });

    it('rejects a player trying to attribute a trade action to someone else', async () => {
      // The token-resolved-playerId === action.playerId guard. Bob is the
      // legitimate target, but he sends the action with playerId set to
      // Alice. Server's first check (handleGameAction) catches the
      // impersonation before the reducer even sees it.
      const { roomId, aliceId, bobToken } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({ token: bobToken, action: { type: 'ACCEPT_TRADE', playerId: aliceId } });
      expect(res.status).toBe(409);
    });

    it('rejects (without disturbing) the existing trade when another player proposes a new one', async () => {
      const { roomId, aliceId, bobId, bobToken, tradeId } = await setupActiveTrade();
      const res = await request(app)
        .post(`/api/rooms/${roomId}/actions`)
        .send({
          token: bobToken,
          action: {
            type: 'PROPOSE_TRADE',
            playerId: bobId,
            targetPlayerId: aliceId,
            offer: { money: 10, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
          },
        });

      // Soft rejection: reported to the caller as a 409, not broadcast/persisted.
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/resolve the current trade/i);

      const after = await roomManager.getRoom(roomId);
      expect(after?.gameState?.activeTrade?.id).toBe(tradeId);
      expect(after?.gameState?.errorMessage).toBeUndefined();
    });
  });
});
