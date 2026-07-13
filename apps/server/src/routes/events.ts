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
    // EventSource cannot set custom headers, so the session token travels in
    // the query string here (unlike every other endpoint, which takes it in
    // the JSON body).
    const token = String(req.query.token ?? '').trim();
    if (!token) {
      return res.status(400).json({ error: 'token query param is required' });
    }

    const room = await roomManager.getRoom(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const auth = await roomManager.authenticate(roomId, token);
    if (!auth) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Hint to any reverse proxy in front of us (nginx, Vercel's edge) to not
    // buffer the response — buffering breaks SSE.
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Everything the stream allocates (EventBus subscription, heartbeat) is
    // released through this idempotent cleanup. It is fully wired — and
    // registered for connection teardown — BEFORE the first write, so a
    // write failure at any point (including the initial snapshot below)
    // can't leave the EventBus subscription (and, on Redis, the duplicated
    // subscriber TCP connection) open forever.
    let cleanedUp = false;
    let unsubscribe: (() => void) | null = null;
    let heartbeat: NodeJS.Timeout | null = null;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
      try {
        res.end();
      } catch {
        // ignore
      }
    };

    // `res`, not `req`: since Node 16 the request's own 'close' fires when
    // the request *body* completes — immediately for a GET — while the
    // response's 'close' fires when the underlying connection tears down,
    // which is the disconnect signal a long-lived stream actually needs.
    res.on('close', cleanup);

    const writeEvent = (event: RoomEvent) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.state)}\n\n`);
      } catch (err) {
        console.warn('[SSE] write failed, closing stream', err);
        cleanup();
      }
    };

    // Initial snapshot so the client doesn't have to wait for the next mutation.
    writeEvent({ type: 'lobby_update', state: room });
    if (room.gameState) {
      writeEvent({ type: 'game_state_update', state: room.gameState });
    }
    // The snapshot write already failed — don't subscribe a dead stream.
    if (cleanedUp) return;

    unsubscribe = await eventBus.subscribe(roomId, writeEvent);
    if (cleanedUp) {
      // The connection dropped while we awaited the subscription handle.
      unsubscribe();
      return;
    }

    // Heartbeat so intermediaries don't tear down idle connections, and so the
    // client's `EventSource.readyState` reflects a live socket.
    heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch (err) {
        console.warn('[SSE] heartbeat write failed, closing stream', err);
        cleanup();
      }
    }, 15_000);
  });

  return router;
};
