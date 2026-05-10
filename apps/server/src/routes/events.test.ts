import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import { createRoomsRouter } from './rooms';
import { createEventsRouter } from './events';

/**
 * Minimal SSE parser sufficient for the single-event-per-frame format we
 * produce. Splits on the canonical `\n\n` boundary and pulls out
 * `event:` / `data:` lines. Lines starting with `:` are ignored (heartbeats).
 */
const parseSSE = (chunk: string): { event: string; data: string }[] => {
  const out: { event: string; data: string }[] = [];
  for (const frame of chunk.split('\n\n')) {
    if (!frame.trim()) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) out.push({ event, data: dataLines.join('\n') });
  }
  return out;
};

describe('SSE: GET /api/rooms/:id/events', () => {
  let app: Express;
  let httpServer: Server;
  let port: number;
  let eventBus: InMemoryEventBus;
  let roomManager: RoomManager;

  beforeEach(async () => {
    roomManager = new RoomManager(new InMemoryRoomStore());
    eventBus = new InMemoryEventBus();
    app = express();
    app.use(express.json());
    app.use(createRoomsRouter({ roomManager, eventBus }));
    app.use(createEventsRouter({ roomManager, eventBus }));
    httpServer = createServer(app);
    await new Promise<void>((res) => httpServer.listen(0, res));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((res) => httpServer.close(() => res()));
  });

  it('rejects unknown rooms with 404', async () => {
    const res = await fetch(`http://localhost:${port}/api/rooms/UNKNOWN/events?userId=x`);
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  it('rejects users not in the room with 403', async () => {
    const roomId = await roomManager.createRoom('Alice');
    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?userId=stranger`);
    expect(res.status).toBe(403);
    await res.body?.cancel();
  });

  it('streams an initial lobby_update snapshot immediately on connect', async () => {
    const roomId = await roomManager.createRoom('Alice');
    const room = (await roomManager.getRoom(roomId))!;
    const hostId = room.players[0].id;

    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?userId=${hostId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const { value } = await reader.read();
    const frames = parseSSE(dec.decode(value));
    expect(frames[0].event).toBe('lobby_update');
    const state = JSON.parse(frames[0].data);
    expect(state.roomId).toBe(roomId);
    expect(state.players[0].id).toBe(hostId);

    await reader.cancel();
  });

  it('forwards a published lobby_update to a subscribed stream', async () => {
    const roomId = await roomManager.createRoom('Alice');
    const room = (await roomManager.getRoom(roomId))!;
    const hostId = room.players[0].id;

    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?userId=${hostId}`);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();

    // Drain initial snapshot first.
    await reader.read();

    // Trigger a lobby change in the background.
    setTimeout(() => {
      void fetch(`http://localhost:${port}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: 'Bob' }),
      });
    }, 10);

    // Read until we get a lobby_update with two players, ignoring heartbeats.
    let received: { event: string; data: string } | null = null;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = dec.decode(value);
      const frames = parseSSE(text);
      for (const f of frames) {
        if (f.event === 'lobby_update') {
          const s = JSON.parse(f.data);
          if (s.players.length === 2) {
            received = f;
            break;
          }
        }
      }
      if (received) break;
    }

    expect(received).not.toBeNull();
    const state = JSON.parse(received!.data);
    expect(state.players.map((p: { name: string }) => p.name).sort()).toEqual(['Alice', 'Bob']);

    await reader.cancel();
  });

  it('strips board data from the initial started-game snapshot', async () => {
    const roomId = await roomManager.createRoom('Alice');
    const room = (await roomManager.getRoom(roomId))!;
    const hostId = room.players[0].id;
    await roomManager.joinRoom(roomId, 'Bob');
    await roomManager.startGame(roomId, hostId);

    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?userId=${hostId}`);
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const frames: { event: string; data: string }[] = [];

    while (frames.length < 2) {
      const { value, done } = await reader.read();
      if (done) break;
      frames.push(...parseSSE(dec.decode(value)));
    }

    const lobbyFrame = frames.find((frame) => frame.event === 'lobby_update');
    const gameFrame = frames.find((frame) => frame.event === 'game_state_update');
    expect(lobbyFrame).toBeTruthy();
    expect(gameFrame).toBeTruthy();
    expect(JSON.parse(lobbyFrame!.data).gameState.board).toBeUndefined();
    expect(JSON.parse(gameFrame!.data).board).toBeUndefined();

    await reader.cancel();
  });
});
