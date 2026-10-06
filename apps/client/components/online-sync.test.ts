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
  /** 0 CONNECTING (browser is retrying), 2 CLOSED (browser gave up). */
  readyState = 1;
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
  onPresence: vi.fn(),
  onSessionExpired: vi.fn(),
  onConnectionChange: vi.fn(),
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

  it('forwards the disconnected ids from a presence event', () => {
    const { source, onPresence } = startSse();

    source.emit('presence', { disconnectedPlayerIds: ['p2', 'p3'] });

    expect(onPresence).toHaveBeenCalledWith(['p2', 'p3']);
  });

  it('ignores a malformed presence payload', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { source, onPresence } = startSse();

    source.emit('presence', '{not json');
    source.emit('presence', { disconnectedPlayerIds: 'nope' });
    source.emit('presence', {});

    expect(onPresence).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('swallows malformed payloads without invoking callbacks', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { source, onLobbyState } = startSse();

    source.emit('lobby_update', '{not json');

    expect(onLobbyState).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  describe('when the stream errors', () => {
    const expiredSnapshot = { ok: false as const, status: 404, error: 'session_expired' };

    it('verifies the session once the browser has given up, and reports an expired one', async () => {
      // A removed player's reconnect gets a non-200 (401), which makes the
      // browser close the stream for good — nothing else would tell them.
      const fetchSnapshot = vi.fn().mockResolvedValue(expiredSnapshot);
      const { source, onSessionExpired } = startSse({ fetchSnapshot });

      source.readyState = 2;
      source.emit('error', {});
      await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));

      expect(fetchSnapshot).toHaveBeenCalledWith('https://server.test', 'ROOM1234', 'secret token');
    });

    it('does nothing while the browser is still retrying on its own', async () => {
      const fetchSnapshot = vi.fn().mockResolvedValue(expiredSnapshot);
      const { source, onSessionExpired } = startSse({ fetchSnapshot });

      source.readyState = 0;
      source.emit('error', {});
      await Promise.resolve();

      expect(fetchSnapshot).not.toHaveBeenCalled();
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it('keeps the session when it is still valid or the check itself failed', async () => {
      const fetchSnapshot = vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, data: { lobby: lobby(1), gameState: null } })
        .mockResolvedValueOnce({ ok: false as const, status: 0, error: 'network down' });
      const { source, onSessionExpired } = startSse({ fetchSnapshot });

      source.readyState = 2;
      source.emit('error', {});
      await vi.waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(1));
      // Let the first check fully settle (clearing its in-flight guard).
      await new Promise((r) => setTimeout(r, 0));
      source.emit('error', {});
      await vi.waitFor(() => expect(fetchSnapshot).toHaveBeenCalledTimes(2));
      await new Promise((r) => setTimeout(r, 0));

      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it('runs one check at a time and stays quiet after stop()', async () => {
      let resolveCheck: (value: unknown) => void = () => {};
      const fetchSnapshot = vi.fn().mockReturnValue(new Promise((r) => (resolveCheck = r)));
      const { source, handle, onSessionExpired } = startSse({ fetchSnapshot });

      source.readyState = 2;
      source.emit('error', {});
      source.emit('error', {});
      expect(fetchSnapshot).toHaveBeenCalledTimes(1);

      handle.stop();
      resolveCheck(expiredSnapshot);
      await Promise.resolve();
      await Promise.resolve();

      expect(onSessionExpired).not.toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('reports lost on a stream error and restored on reopen, once per change', () => {
      const { source, onConnectionChange } = startSse();

      source.emit('open', {});
      expect(onConnectionChange).not.toHaveBeenCalled(); // starts out connected

      source.readyState = 0;
      source.emit('error', {});
      source.emit('error', {}); // browser retries; repeat errors stay quiet
      expect(onConnectionChange).toHaveBeenCalledTimes(1);
      expect(onConnectionChange).toHaveBeenLastCalledWith(false);

      source.readyState = 1;
      source.emit('open', {});
      expect(onConnectionChange).toHaveBeenCalledTimes(2);
      expect(onConnectionChange).toHaveBeenLastCalledWith(true);
    });

    it('stays quiet after stop()', () => {
      const { source, handle, onConnectionChange } = startSse();

      handle.stop();
      source.emit('error', {});

      expect(onConnectionChange).not.toHaveBeenCalled();
    });
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

  const snapshot = (version: number, withGame = false, disconnectedPlayerIds: string[] = []) => ({
    ok: true as const,
    data: {
      lobby: lobby(version),
      gameState: withGame ? gameState : null,
      disconnectedPlayerIds,
    },
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

  it('forwards presence from the first snapshot, even when empty', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot(1, true, ['p2']));
    const { onPresence } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);

    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(onPresence).toHaveBeenCalledWith(['p2']);
  });

  it('does not re-report an unchanged presence set while backing off', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot(1, true, ['p2']));
    const { onPresence } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS);
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS);

    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
    expect(onPresence).toHaveBeenCalledTimes(1);
  });

  it('reports a presence-only change that the version shortcut would swallow', async () => {
    // Same lobby version both times: nothing in the room record changed, only
    // who is connected. The unchanged-version skip must not hide that.
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot(1, true, []))
      .mockResolvedValue(snapshot(1, true, ['p2']));
    const { onPresence, onLobbyState, onGameState } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS);

    expect(onPresence).toHaveBeenLastCalledWith(['p2']);
    expect(onPresence).toHaveBeenCalledTimes(2);
    // ...without re-applying the unchanged room.
    expect(onLobbyState).toHaveBeenCalledTimes(1);
    expect(onGameState).toHaveBeenCalledTimes(1);
  });

  it('keeps the fast cadence right after a presence change, then backs off again', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot(1, true, []))
      .mockResolvedValue(snapshot(1, true, ['p2']));
    startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0); // first
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // presence changed, version same
    await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // still fast: next poll is due at MIN
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);

    // That poll was fully unchanged, so now it backs off to the slow cadence.
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS - 1);
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSnapshot).toHaveBeenCalledTimes(4);
  });

  it('treats a server that omits disconnectedPlayerIds as nobody disconnected', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValue({ ok: true as const, data: { lobby: lobby(1), gameState: null } });
    const { onPresence } = startPoll(fetchSnapshot);

    await vi.advanceTimersByTimeAsync(0);

    expect(onPresence).toHaveBeenCalledWith([]);
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

  describe('connection state', () => {
    const networkDown = { ok: false as const, status: 0, error: 'network down' };

    it('reports lost on a network failure and restored on the next good poll', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchSnapshot = vi
        .fn()
        .mockResolvedValueOnce(snapshot(1))
        .mockResolvedValueOnce(networkDown)
        .mockResolvedValueOnce(networkDown)
        .mockResolvedValue(snapshot(1));
      const { onConnectionChange } = startPoll(fetchSnapshot);

      await vi.advanceTimersByTimeAsync(0); // first poll ok: still connected, no call
      expect(onConnectionChange).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // network down
      await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // still down: no repeat call
      expect(onConnectionChange).toHaveBeenCalledTimes(1);
      expect(onConnectionChange).toHaveBeenLastCalledWith(false);

      await vi.advanceTimersByTimeAsync(MIN_POLL_MS); // server back, same version
      expect(onConnectionChange).toHaveBeenCalledTimes(2);
      expect(onConnectionChange).toHaveBeenLastCalledWith(true);
    });

    it('treats a server error status as reachable', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchSnapshot = vi
        .fn()
        .mockResolvedValue({ ok: false as const, status: 503, error: 'unavailable' });
      const { onConnectionChange } = startPoll(fetchSnapshot);

      await vi.advanceTimersByTimeAsync(MIN_POLL_MS * 2);

      expect(onConnectionChange).not.toHaveBeenCalled();
    });

    it('stays quiet when the first poll fails and stop() has been called', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      let resolveFetch: (value: unknown) => void = () => {};
      const fetchSnapshot = vi.fn().mockReturnValue(new Promise((r) => (resolveFetch = r)));
      const { handle, onConnectionChange } = startPoll(fetchSnapshot);

      handle.stop();
      resolveFetch(networkDown);
      await vi.advanceTimersByTimeAsync(0);

      expect(onConnectionChange).not.toHaveBeenCalled();
    });
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
