import type { GameState, LobbyState } from '@trade-tycoon/game-logic';
import { reconnectToRoom } from './online-api';

/**
 * Framework-free room synchronization engine: the SSE-vs-polling logic that
 * keeps a client's lobby/game state in step with the server. Extracted from
 * `OnlineGame.tsx` so the sync behavior (version skipping, poll backoff,
 * session expiry, event parsing) is unit-testable in the node environment —
 * the component keeps only a thin `useEffect` that forwards callbacks into
 * React state. The EventSource factory and snapshot fetcher are injectable
 * for the same reason.
 */

/** Poll floor while the room is active. */
export const MIN_POLL_MS = 2000;
/** Poll ceiling reached after an unchanged (version-identical) snapshot. */
export const MAX_POLL_MS = 5000;

type SyncMessageEvent = { data: string };

/** Structural subset of the DOM EventSource, so tests can substitute a fake. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: SyncMessageEvent) => void): void;
  close(): void;
}

export interface RoomSyncOptions {
  serverUrl: string;
  roomId: string;
  token: string;
  /** 'sse' when EventSource is available (web), 'poll' otherwise (native). */
  transport: 'sse' | 'poll';
  onLobbyState: (state: LobbyState) => void;
  onGameState: (state: GameState) => void;
  /** Poll transport only: the server reported the session gone (404). */
  onSessionExpired: () => void;
  /** Test injectable; defaults to `new EventSource(url)`. */
  createEventSource?: (url: string) => EventSourceLike;
  /** Test injectable; defaults to online-api's `reconnectToRoom`. */
  fetchSnapshot?: typeof reconnectToRoom;
}

export interface RoomSyncHandle {
  /** Idempotent: closes the SSE stream / cancels the pending poll. */
  stop(): void;
}

const defaultCreateEventSource = (url: string): EventSourceLike => {
  const source = new EventSource(url);
  source.onerror = () => {
    // EventSource auto-reconnects on its own; we just log so the user can
    // see what's happening if they have devtools open.
    console.warn('SSE connection hiccup; browser will retry automatically');
  };
  return source;
};

export function startRoomSync(options: RoomSyncOptions): RoomSyncHandle {
  const {
    serverUrl,
    roomId,
    token,
    transport,
    onLobbyState,
    onGameState,
    onSessionExpired,
    createEventSource = defaultCreateEventSource,
    fetchSnapshot = reconnectToRoom,
  } = options;

  if (transport === 'sse') {
    // EventSource cannot set headers, so the token travels in the query
    // string (the server accepts this tradeoff for the events route only).
    const url = `${serverUrl}/api/rooms/${encodeURIComponent(
      roomId
    )}/events?token=${encodeURIComponent(token)}`;
    const source = createEventSource(url);

    source.addEventListener('lobby_update', (event) => {
      try {
        onLobbyState(JSON.parse(event.data) as LobbyState);
      } catch (err) {
        console.error('Bad lobby_update payload', err);
      }
    });
    source.addEventListener('game_state_update', (event) => {
      try {
        onGameState(JSON.parse(event.data) as GameState);
      } catch (err) {
        console.error('Bad game_state_update payload', err);
      }
    });

    return { stop: () => source.close() };
  }

  // Poll transport (no EventSource on native). Polling on a fixed interval
  // would force a fresh state object into React on every tick even when
  // nothing changed; the server's `lobby.version` (bumped on every successful
  // write) lets us detect "nothing changed" cheaply, skip the callbacks, and
  // back off the poll interval while idle.
  let stopped = false;
  let syncInFlight = false;
  let lastSeenVersion: number | undefined;
  let pollHandle: ReturnType<typeof setTimeout> | undefined;
  let nextPollDelay = MIN_POLL_MS;

  const scheduleNextPoll = () => {
    if (stopped) return;
    pollHandle = setTimeout(() => {
      void syncRoomSnapshot();
    }, nextPollDelay);
  };

  const syncRoomSnapshot = async () => {
    if (syncInFlight) return;
    syncInFlight = true;
    let reschedule = true;
    try {
      const result = await fetchSnapshot(serverUrl, roomId, token);
      if (stopped) return;
      if (!result.ok) {
        if (result.status === 404) {
          // Session gone for good — polling again would just repeat the 404.
          reschedule = false;
          onSessionExpired();
        } else if (result.status !== 0) {
          console.warn('Native room sync failed:', result.error);
        }
        return;
      }

      const body = result.data;
      const version = body.lobby.version;
      const unchanged = version !== undefined && version === lastSeenVersion;
      if (unchanged) {
        nextPollDelay = MAX_POLL_MS;
        return;
      }

      lastSeenVersion = version;
      nextPollDelay = MIN_POLL_MS;
      onLobbyState(body.lobby);
      if (body.gameState) {
        onGameState(body.gameState);
      }
    } finally {
      syncInFlight = false;
      if (reschedule) scheduleNextPoll();
    }
  };

  void syncRoomSnapshot();

  return {
    stop: () => {
      stopped = true;
      if (pollHandle !== undefined) clearTimeout(pollHandle);
    },
  };
}
