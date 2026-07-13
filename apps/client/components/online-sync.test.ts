import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GameState, LobbyState } from '@trade-tycoon/game-logic';
import type { reconnectToRoom } from './online-api';
import {
  startRoomSync,
  MIN_POLL_MS,
  MAX_POLL_MS,
  type EventSourceLike,
  type RoomSyncOptions,
} from './online-sync';

class FakeEventSource implements EventSourceLike {
  closed = false;
  private listeners = new Map<string, ((event: { data: string }) => void)[]>();

  constructor(public readonly url: string) {}

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, payload: unknown): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data });
    }
  }
}

const lobby = (version: number): LobbyState => ({
  roomId: 'ROOM1234',
  players: [],
  status: 'lobby',
  version,
});

const gameState = { currentPlayerId: 'p1' } as unknown as GameState;

const callbacks = () => ({
  onLobbyState: vi.fn(),
  onGameState: vi.fn(),
  onSessionExpired: vi.fn(),
});

describe('startRoomSync (sse)', () => {
  const startSse = (overrides: Partial<RoomSyncOptions> = {}) => {
    let source: FakeEventSource | null = null;
    const cbs = callbacks();
    const handle = startRoomSync({
      serverUrl: 'https://server.test',
      roomId: 'ROOM1234',
      token: 'secret token',
      transport: 'sse',
      ...cbs,
      createEventSource: (url) => {
        source = new FakeEventSource(url);
        return source;
      },
      ...overrides,
    });
    return { handle, source: source! as FakeEventSource, ...cbs };
  };

  it('connects to the token-authenticated events url', () => {
    const { source } = startSse();
    expect(source.url).toBe('https://server.test/api/rooms/ROOM1234/events?token=secret%20token');
  });

  it('forwards parsed lobby and game events', () => {
    const { source, onLobbyState, onGameState } = startSse();

    source.emit('lobby_update', lobby(3));
    source.emit('game_state_update', gameState);

    expect(onLobbyState).toHaveBeenCalledWith(lobby(3));
    expect(onGameState).toHaveBeenCalledWith(gameState);
  });

  it('swallows malformed payloads without invoking callbacks', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { source, onLobbyState } = startSse();

    source.emit('lobby_update', '{not json');

    expect(onLobbyState).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('stop() closes the event source', () => {
    const { handle, source } = startSse();
    handle.stop();
    expect(source.closed).toBe(true);
  });
});

describe('startRoomSync (poll)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const startPoll = (fetchSnapshot: typeof reconnectToRoom) => {
    const cbs = callbacks();
    const handle = startRoomSync({
      serverUrl: 'https://server.test',
      roomId: 'ROOM1234',
      token: 'tok',
      transport: 'poll',
      ...cbs,
      fetchSnapshot,
    });
    return { handle, ...cbs };
  };

  const snapshot = (version: number, withGame = false) => ({
    ok: true as const,
    data: { lobby: lobby(version), gameState: withGame ? gameState : null },
  });

  it('applies the first snapshot, including a running game', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot(1, true));
    const { onLobbyState, onGameState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);

    expect(onLobbyState).toHaveBeenCalledWith(lobby(1));
    expect(onGameState).toHaveBeenCalledWith(gameState);
  });

  it('skips callbacks and backs off while the version is unchanged', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot(1));
    const { onLobbyState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0); // first snapshot applied
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // second poll: unchanged
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(onLobbyState).toHaveBeenCalledTimes(1);

    // Backed off: the third poll fires after MAX_POLL_MS, not MIN_POLL_MS.
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS - 1);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it('resets to the fast cadence when the version changes', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(snapshot(2))
      .mockResolvedValue(snapshot(3));
    const { onLobbyState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0); // v1 applied → MIN cadence
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // v1 unchanged → MAX cadence
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS); // v2 applied → MIN cadence again
    expect(onLobbyState).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // v3 already due at MIN
    expect(fetchSnapshot).toHaveBeenCalledTimes(4);
    expect(onLobbyState).toHaveBeenCalledTimes(3);
  });

  it('reports an expired session once and stops polling', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValue({ ok: false as const, status: 404, error: 'session_expired' });
    const { onSessionExpired, onLobbyState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onLobbyState).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 4);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through transient network errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, status: 0, error: 'network down' })
      .mockResolvedValue(snapshot(1));
    const { onLobbyState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);
    expect(onLobbyState).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(MIN_POLL_MS);
    expect(onLobbyState).toHaveBeenCalledWith(lobby(1));
    warnSpy.mockRestore();
  });

  it('stop() cancels the pending poll', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot(1));
    const { handle } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);
    handle.stop();

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 4);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });
});
