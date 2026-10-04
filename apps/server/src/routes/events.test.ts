import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import { InMemoryEventBus } from '../events/InMemoryEventBus';
import { createRoomsRouter } from './rooms';
import { createEventsRouter } from './events';
import { setupGame, STALE } from '../test-utils/room-game';

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
    const res = await fetch(`http://localhost:${port}/api/rooms/UNKNOWN/events?token=x`);
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  it('rejects an unknown token with 401', async () => {
    const { roomId } = await roomManager.createRoom('Alice');
    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?token=stranger`);
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it('rejects a stolen public playerId used as a token with 401', async () => {
    const { roomId, playerId: hostId } = await roomManager.createRoom('Alice');
    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?token=${hostId}`);
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it('streams an initial lobby_update snapshot immediately on connect', async () => {
    const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Alice');

    const res = await fetch(
      `http://localhost:${port}/api/rooms/${roomId}/events?token=${hostToken}`
    );
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
    expect(state.sessions).toBeUndefined();

    await reader.cancel();
  });

  it('forwards a published lobby_update to a subscribed stream', async () => {
    const { roomId, token: hostToken } = await roomManager.createRoom('Alice');

    const res = await fetch(
      `http://localhost:${port}/api/rooms/${roomId}/events?token=${hostToken}`
    );
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

  it('unsubscribes from the event bus when the client disconnects', async () => {
    const { roomId, token } = await roomManager.createRoom('Alice');

    // Wrap the real subscribe so the test can observe the unsubscribe handle
    // the SSE route holds — the leak fixed here was exactly this handle never
    // being called after a dead stream.
    let unsubscribed = false;
    const realSubscribe = eventBus.subscribe.bind(eventBus);
    vi.spyOn(eventBus, 'subscribe').mockImplementation(async (id, handler) => {
      const unsub = await realSubscribe(id, handler);
      return () => {
        unsubscribed = true;
        unsub();
      };
    });

    const res = await fetch(`http://localhost:${port}/api/rooms/${roomId}/events?token=${token}`);
    const reader = res.body!.getReader();
    await reader.read(); // drain the initial snapshot

    // Tear the connection down, then publish: whichever fires first — the
    // response 'close' event or the failed write — must release the
    // subscription.
    await reader.cancel();
    await eventBus.publish(roomId, {
      type: 'lobby_update',
      state: (await roomManager.getRoom(roomId))!,
    });

    await vi.waitFor(() => expect(unsubscribed).toBe(true));
  });

  it('strips board data from the initial started-game snapshot', async () => {
    const { roomId, token: hostToken } = await roomManager.createRoom('Alice');
    await roomManager.joinRoom(roomId, 'Bob');
    await roomManager.startGame(roomId, hostToken);

    const res = await fetch(
      `http://localhost:${port}/api/rooms/${roomId}/events?token=${hostToken}`
    );
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

describe('SSE: presence event', () => {
  it('sends an initial presence frame, then only when the set changes', async () => {
    const ctx = await setupGame(['Alice', 'Bob', 'Cara']);
    const eventBus = new InMemoryEventBus();
    const app = express();
    app.use(express.json());
    app.use(createEventsRouter({ roomManager: ctx.manager, eventBus, heartbeatMs: 15 }));
    const server = createServer(app);
    await new Promise<void>((res) => server.listen(0, res));
    const port = (server.address() as AddressInfo).port;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      const res = await fetch(
        `http://localhost:${port}/api/rooms/${ctx.roomId}/events?token=${ctx.seats[0].token}`
      );
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      const presenceFrames: string[][] = [];

      // One long-lived reader: racing reads against a timer would leave a
      // queued read behind that swallows the next chunk. Frames can also arrive
      // split across reads, so only complete ones are parsed.
      let pending = '';
      const pump = (async () => {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          pending += dec.decode(value);
          const boundary = pending.lastIndexOf('\n\n');
          if (boundary < 0) continue;
          const complete = pending.slice(0, boundary + 2);
          pending = pending.slice(boundary + 2);
          for (const f of parseSSE(complete)) {
            if (f.event === 'presence') {
              presenceFrames.push(JSON.parse(f.data).disconnectedPlayerIds);
            }
          }
        }
      })();

      // Quiet room: one initial frame, then nothing despite several ticks.
      await sleep(150);
      expect(presenceFrames).toEqual([[]]);

      // Time passes with only Alice's stream alive → Bob and Cara go stale.
      ctx.clock.now += STALE;
      await sleep(150);
      expect(presenceFrames).toEqual([[], [ctx.seats[1].playerId, ctx.seats[2].playerId]]);

      // Bob polls again → set shrinks, exactly one more frame.
      await ctx.manager.recordSeen(ctx.roomId, ctx.seats[1].playerId);
      await sleep(150);
      expect(presenceFrames).toEqual([
        [],
        [ctx.seats[1].playerId, ctx.seats[2].playerId],
        [ctx.seats[2].playerId],
      ]);

      await reader.cancel();
      await pump;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((res) => server.close(() => res()));
    }
  });
});
