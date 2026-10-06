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

/** `EventSource.CLOSED`: the browser has given up reconnecting. */
const EVENT_SOURCE_CLOSED = 2;

/** Poll floor while the room is active. */
export const MIN_POLL_MS = 2000;
/** Poll ceiling reached after an unchanged (version-identical) snapshot. */
export const MAX_POLL_MS = 5000;

interface SyncMessageEvent {
  data: string;
}

/** Structural subset of the DOM EventSource, so tests can substitute a fake. */
export interface EventSourceLike {
  /**
   * DOM values: 0 CONNECTING (the browser is retrying), 1 OPEN, 2 CLOSED (it
   * gave up). Optional so a minimal fake needn't provide it.
   */
  readonly readyState?: number;
  addEventListener(_type: string, listener: (event: SyncMessageEvent) => void): void;
  close(): void;
}

export interface RoomSyncOptions {
  serverUrl: string;
  roomId: string;
  token: string;
  /** 'sse' when EventSource is available (web), 'poll' otherwise (native). */
  transport: 'sse' | 'poll';
  onLobbyState: (_state: LobbyState) => void;
  onGameState: (_state: GameState) => void;
  /**
   * Ids of players in the running game the server hasn't heard from lately.
   * Presence is a side channel, not room state: it arrives as its own SSE
   * `presence` event, or alongside each poll snapshot, and never moves
   * `version`.
   */
  onPresence: (_disconnectedPlayerIds: string[]) => void;
  /** Poll transport only: the server reported the session gone (404). */
  onSessionExpired: () => void;
  /**
   * Whether the server is reachable. Called with the first result a sync
   * observes, then only when the answer changes. The first is always reported
   * because the caller may start a new sync (the effect re-runs) while its own
   * state still says "lost". Any HTTP answer (even an error status) counts as
   * reachable; `false` means the request or the stream failed at the network
   * level, so the screen may be out of date.
   */
  onConnectionChange: (_connected: boolean) => void;
  /** Test injectable; defaults to `new EventSource(url)`. */
  createEventSource?: (_url: string) => EventSourceLike;
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
    onPresence,
    onSessionExpired,
    onConnectionChange,
    createEventSource = defaultCreateEventSource,
    fetchSnapshot = reconnectToRoom,
  } = options;

  let stopped = false;
  let connected: boolean | undefined;
  const reportConnection = (next: boolean) => {
    if (stopped || next === connected) return;
    connected = next;
    onConnectionChange(next);
  };

  if (transport === 'sse') {
    let verifying = false;
    // EventSource cannot set headers, so the token travels in the query
    // string (the server accepts this tradeoff for the events route only).
    const url = `${serverUrl}/api/rooms/${encodeURIComponent(
      roomId
    )}/events?token=${encodeURIComponent(token)}`;
    const source = createEventSource(url);

    // The browser reconnects quietly after a drop, so `error` is the only sign
    // the view is going stale and `open` the only sign it is live again.
    source.addEventListener('open', () => {
      reportConnection(true);
    });

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

    // A network blip leaves the stream CONNECTING and the browser retries on its
    // own. But a non-200 reconnect — e.g. 401 because the host removed this
    // player while they were offline — closes the stream for good with no
    // event we could act on, so the player would sit on a stale screen. Once
    // it is CLOSED, ask `/reconnect` (whose 404 means the session is gone).
    source.addEventListener('error', () => {
      reportConnection(false);
      if (source.readyState !== EVENT_SOURCE_CLOSED || verifying || stopped) return;
      verifying = true;
      void fetchSnapshot(serverUrl, roomId, token)
        .then((result) => {
          if (!stopped && !result.ok && result.status === 404) onSessionExpired();
        })
        .finally(() => {
          verifying = false;
        });
    });

    source.addEventListener('presence', (event) => {
      try {
        const body = JSON.parse(event.data) as { disconnectedPlayerIds?: unknown };
        if (!Array.isArray(body.disconnectedPlayerIds)) throw new Error('missing id list');
        onPresence(body.disconnectedPlayerIds as string[]);
      } catch (err) {
        console.error('Bad presence payload', err);
      }
    });

    return {
      stop: () => {
        stopped = true;
        source.close();
      },
    };
  }

  // Poll transport (no EventSource on native). Polling on a fixed interval
  // would force a fresh state object into React on every tick even when
  // nothing changed; the server's `lobby.version` (bumped on every successful
  // write) lets us detect "nothing changed" cheaply, skip the callbacks, and
  // back off the poll interval while idle.
  let syncInFlight = false;
  let lastSeenVersion: number | undefined;
  // The server lists ids in lobby order, so a joined string is a stable key.
  let lastPresenceKey: string | undefined;
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
      // Status 0 is the network-level failure; any other answer (even a 5xx)
      // means the server is there.
      reportConnection(result.ok || result.status !== 0);
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

      // Presence moves independently of `version` (nothing is written to the
      // room when someone goes quiet), so it is compared on its own: the
      // version shortcut below must never swallow a presence-only change.
      const disconnected = body.disconnectedPlayerIds ?? [];
      const presenceKey = disconnected.join(',');
      const presenceChanged = presenceKey !== lastPresenceKey;
      if (presenceChanged) {
        lastPresenceKey = presenceKey;
        onPresence(disconnected);
      }

      const unchanged = version !== undefined && version === lastSeenVersion;
      if (unchanged) {
        // Stay on the fast cadence for one more poll after a presence change so
        // a player coming back is noticed promptly; back off once it is stable.
        nextPollDelay = presenceChanged ? MIN_POLL_MS : MAX_POLL_MS;
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
