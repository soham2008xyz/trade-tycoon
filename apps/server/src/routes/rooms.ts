import { Router, type Request, type Response } from 'express';
import type { GameAction } from '@trade-tycoon/game-logic';
import type { RoomManager } from '../RoomManager';
import type { EventBus } from '../events/EventBus';

/**
 * REST surface that replaces the Socket.IO control plane. Each endpoint
 * mutates room state through `RoomManager` and then publishes the resulting
 * lobby/game state on `EventBus` so any open SSE streams (in any function
 * instance) can fan it out to subscribers.
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
      const roomId = await roomManager.createRoom(playerName);
      const room = await roomManager.getRoom(roomId);
      if (!room) {
        return res.status(500).json({ error: 'Room creation succeeded but room not found' });
      }
      const host = room.players[0];
      // Notify any SSE streams already open for this room (rare on create, but
      // harmless and consistent with the join/start path).
      await eventBus.publish(roomId, { type: 'lobby_update', state: room });
      res.status(201).json({ roomId, userId: host.id, isHost: true });
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
    res.status(200).json({ roomId, userId: result.userId, isHost: false });
  });

  // POST /api/rooms/:roomId/start { userId }
  router.post('/api/rooms/:roomId/start', async (req: Request, res: Response) => {
    const userId = parseNonEmptyString(req.body?.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const gameState = await roomManager.startGame(roomId, userId);
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

  // POST /api/rooms/:roomId/actions { userId, action }
  router.post('/api/rooms/:roomId/actions', async (req: Request, res: Response) => {
    const userId = parseNonEmptyString(req.body?.userId);
    const action = req.body?.action as GameAction | undefined;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return res.status(400).json({ error: 'action is required' });
    }

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const room = await roomManager.getRoom(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.gameState) return res.status(409).json({ error: 'Game has not started' });

    const player = room.gameState.players.find((p) => p.id === userId);
    if (!player) return res.status(403).json({ error: 'You are not in this game' });

    const newState = await roomManager.handleGameAction(roomId, userId, action);
    if (!newState) return res.status(409).json({ error: 'Action rejected' });
    await eventBus.publish(roomId, { type: 'game_state_update', state: newState });
    res.status(200).json({ ok: true });
  });

  // POST /api/rooms/:roomId/reconnect { userId }
  router.post('/api/rooms/:roomId/reconnect', async (req: Request, res: Response) => {
    const userId = parseNonEmptyString(req.body?.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const result = await roomManager.reconnect(roomId, userId);
    if (!result) return res.status(404).json({ error: 'session_expired' });
    res.status(200).json({
      lobby: result.state,
      gameState: result.gameState ?? null,
    });
  });

  // POST /api/rooms/:roomId/leave { userId }
  router.post('/api/rooms/:roomId/leave', async (req: Request, res: Response) => {
    const userId = parseNonEmptyString(req.body?.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const roomId = String(req.params.roomId).trim().toUpperCase();
    const result = await roomManager.leaveRoom(roomId, userId);
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
