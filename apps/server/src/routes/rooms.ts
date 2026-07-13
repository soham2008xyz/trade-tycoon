import { Router, type Request, type Response } from 'express';
import { parseGameAction } from '@trade-tycoon/game-logic';
import type { RoomManager } from '../RoomManager';
import type { EventBus } from '../events/EventBus';

/**
 * REST surface that replaces the Socket.IO control plane. Each endpoint
 * mutates room state through `RoomManager` and then publishes the resulting
 * lobby/game state on `EventBus` so any open SSE streams (in any function
 * instance) can fan it out to subscribers.
 *
 * Auth: create/join return a `playerId` (public, safe to broadcast) and a
 * `token` (private credential). Every other endpoint takes `token`, not
 * `playerId` — the public id alone grants no ability to act as that player.
 *
 * Errors are reported with conventional HTTP status codes — clients should
 * not need to parse `error: 'session_expired'` strings; they get 404 / 409 /
 * 400 instead, which `fetch` handles naturally.
 */
export const createRoomsRouter = (deps: {
  roomManager: RoomManager;
  eventBus: EventBus;
}): Router => {
  const { roomManager, eventBus } = deps;
  const router = Router();

  // POST /api/rooms { playerName }
  router.post('/api/rooms', async (req: Request, res: Response) => {
    const playerName = parseNonEmptyString(req.body?.playerName);
    if (!playerName) return res.status(400).json({ error: 'playerName is required' });

    try {
      const { roomId, playerId, token } = await roomManager.createRoom(playerName);
      const room = await roomManager.getRoom(roomId);
      if (!room) {
        return res.status(500).json({ error: 'Room creation succeeded but room not found' });
      }
      // Notify any SSE streams already open for this room (rare on create, but
      // harmless and consistent with the join/start path).
      await eventBus.publish(roomId, { type: 'lobby_update', state: room });
      res.status(201).json({ roomId, playerId, token, isHost: true });
    } catch (err) {
      console.error('[POST /api/rooms]', err);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // POST /api/rooms/:roomId/join { playerName }
  router.post('/api/rooms/:roomId/join', async (req: Request, res: Response) => {
    const playerName = parseNonEmptyString(req.body?.playerName);
    if (!playerName) return res.status(400).json({ error: 'playerName is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const result = await roomManager.joinRoom(roomId, playerName);
    if (!result) {
      const exists = await roomManager.getRoom(roomId);
      if (!exists) return res.status(404).json({ error: 'Room not found' });
      return res.status(409).json({ error: 'Room is full or already in progress' });
    }
    await eventBus.publish(roomId, { type: 'lobby_update', state: result.state });
    res.status(200).json({ roomId, playerId: result.playerId, token: result.token, isHost: false });
  });

  // POST /api/rooms/:roomId/start { token }
  router.post('/api/rooms/:roomId/start', async (req: Request, res: Response) => {
    const token = parseNonEmptyString(req.body?.token);
    if (!token) return res.status(400).json({ error: 'token is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const gameState = await roomManager.startGame(roomId, token);
    if (!gameState) {
      const room = await roomManager.getRoom(roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      return res
        .status(409)
        .json({ error: 'Cannot start game: must be host with at least 2 players' });
    }
    await eventBus.publish(roomId, { type: 'game_state_update', state: gameState });
    const lobby = await roomManager.getRoom(roomId);
    if (lobby) {
      await eventBus.publish(roomId, { type: 'lobby_update', state: lobby });
    }
    res.status(200).json({ ok: true });
  });

  // POST /api/rooms/:roomId/actions { token, action }
  router.post('/api/rooms/:roomId/actions', async (req: Request, res: Response) => {
    const token = parseNonEmptyString(req.body?.token);
    if (!token) return res.status(400).json({ error: 'token is required' });

    const action = parseGameAction(req.body?.action);
    if (!action) {
      return res.status(400).json({ error: 'action is invalid' });
    }

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const room = await roomManager.getRoom(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.gameState) return res.status(409).json({ error: 'Game has not started' });

    const newState = await roomManager.handleGameAction(roomId, token, action);
    if (!newState) return res.status(409).json({ error: 'Action rejected' });
    await eventBus.publish(roomId, { type: 'game_state_update', state: newState });
    res.status(200).json({ ok: true });
  });

  // POST /api/rooms/:roomId/reconnect { token }
  router.post('/api/rooms/:roomId/reconnect', async (req: Request, res: Response) => {
    const token = parseNonEmptyString(req.body?.token);
    if (!token) return res.status(400).json({ error: 'token is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const result = await roomManager.reconnect(roomId, token);
    if (!result) return res.status(404).json({ error: 'session_expired' });
    res.status(200).json({
      lobby: result.state,
      gameState: result.gameState ?? null,
    });
  });

  // POST /api/rooms/:roomId/leave { token }
  router.post('/api/rooms/:roomId/leave', async (req: Request, res: Response) => {
    const token = parseNonEmptyString(req.body?.token);
    if (!token) return res.status(400).json({ error: 'token is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const result = await roomManager.leaveRoom(roomId, token);
    if (!result) return res.status(404).json({ error: 'session_expired' });

    if (result.gameState) {
      await eventBus.publish(roomId, { type: 'game_state_update', state: result.gameState });
    }
    await eventBus.publish(roomId, { type: 'lobby_update', state: result.state });
    res.status(200).json({ ok: true });
  });

  return router;
};

const parseNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
