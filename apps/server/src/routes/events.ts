import { Router, type Request, type Response } from 'express';
import type { RoomManager } from '../RoomManager';
import type { EventBus, RoomEvent } from '../events/EventBus';

/**
 * Server-Sent Events stream that replaces the Socket.IO push channel.
 *
 * Lifecycle of one SSE connection:
 *   1. Validate the user is in the room (`RoomStore.get` + check players).
 *   2. Send an immediate snapshot so clients never start with empty UI.
 *   3. Subscribe to the EventBus and write each fan-out message to the stream.
 *   4. On request close (client disconnect, browser navigation, function
 *      timeout), call the unsubscribe handle so we don't leak subscriptions
 *      or hold a Redis subscriber TCP connection forever.
 *
 * On Vercel the function will time out at ~300s; the browser's `EventSource`
 * automatically reconnects on close, which lands on a fresh function instance
 * and starts a new lifecycle from step 1.
 */
export const createEventsRouter = (deps: {
  roomManager: RoomManager;
  eventBus: EventBus;
}): Router => {
  const { roomManager, eventBus } = deps;
  const router = Router();

  router.get('/api/rooms/:roomId/events', async (req: Request, res: Response) => {
    const roomId = String(req.params.roomId).trim().toUpperCase();
    const userId = String(req.query.userId ?? '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'userId query param is required' });
    }

    const room = await roomManager.getRoom(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const inLobby = room.players.some((p) => p.id === userId);
    const inGame = room.gameState?.players.some((p) => p.id === userId) ?? false;
    if (!inLobby && !inGame) {
      return res.status(403).json({ error: 'You are not in this room' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Hint to any reverse proxy in front of us (nginx, Vercel's edge) to not
    // buffer the response — buffering breaks SSE.
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const writeEvent = (event: RoomEvent) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.state)}\n\n`);
      } catch (err) {
        console.warn('[SSE] write failed, closing stream', err);
      }
    };

    // Initial snapshot so the client doesn't have to wait for the next mutation.
    writeEvent({ type: 'lobby_update', state: room });
    if (room.gameState) {
      writeEvent({ type: 'game_state_update', state: room.gameState });
    }

    const unsubscribe = await eventBus.subscribe(roomId, writeEvent);

    // Heartbeat so intermediaries don't tear down idle connections, and so the
    // client's `EventSource.readyState` reflects a live socket.
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        // ignore — the close handler will clean up.
      }
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        res.end();
      } catch {
        // ignore
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  });

  return router;
};
