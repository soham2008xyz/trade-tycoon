import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Platform } from 'react-native';
import type { GameState, LobbyState } from '@trade-tycoon/game-logic';
import { supportsOnlineEventStream } from '../components/online-platform';
import { startRoomSync, type RoomSyncHandle } from '../components/online-sync';
import {
  readStoredSession,
  writeStoredSession,
  clearStoredSession,
} from '../components/session-storage';
import { wasRemovedFromRoom } from '../components/multiplayer-gating';
import { reconnectToRoom, type JoinedRoomResponse } from '../components/online-api';
import { useTransientError } from './useTransientError';

export type OnlineMode = 'create' | 'join' | 'resume';
export type OnlineStep = 'connect' | 'lobby' | 'game' | 'resuming';
type Setter<T> = Dispatch<SetStateAction<T>>;
// Generic so call sites name no `X | null` union: Codacy can't resolve the
// game-logic types, reads them as `any` and flags such unions as redundant.
type Nullable<T> = T | null;
type ShowError = ReturnType<typeof useTransientError>['setTransientError'];

interface RoomSetters {
  setLobbyState: Setter<Nullable<LobbyState>>;
  setGameState: Setter<Nullable<GameState>>;
  setStep: Setter<OnlineStep>;
  setRoomId: Setter<string>;
  setPlayerId: Setter<string | null>;
  setToken: Setter<string | null>;
}

// Resume flow: validate the stored session against the server before
// hydrating local state. If the room/token is gone (server restart, room
// expired, host kicked the player), drop the stored session and bounce the
// user back to the previous screen so they can start fresh.
function useResumeSession(
  serverUrl: string,
  resume: boolean,
  onBack: () => void,
  room: RoomSetters
) {
  // Captured once: the effect below runs exactly once per mount, with the
  // `onBack` of the first render, and the parent passes a new closure on
  // every render.
  const onBackRef = useRef(onBack);
  const { setLobbyState, setGameState, setStep, setRoomId, setPlayerId, setToken } = room;

  useEffect(() => {
    if (!resume) return;
    // An abort signal, not a `let cancelled`: the cleanup flips it while the
    // async body is awaiting, which static analysis can't see through a
    // boolean it watched being set to false.
    const run = new AbortController();
    const goBack = onBackRef.current;
    void (async () => {
      const session = await readStoredSession();
      if (run.signal.aborted) return;
      if (!session) {
        goBack();
        return;
      }
      const result = await reconnectToRoom(serverUrl, session.roomId, session.token);
      if (run.signal.aborted) return;
      if (!result.ok) {
        if (result.status === 0) {
          // Network error: we don't know if the session is still valid —
          // leave the stored session alone and bounce so the user can retry.
          console.error('Resume failed:', result.error);
          goBack();
          return;
        }
        // 404 session_expired, or any other failure — drop the session and exit.
        // Awaited so the menu we return to doesn't read it back (#258).
        await clearStoredSession();
        goBack();
        return;
      }
      const body = result.data;
      setLobbyState(body.lobby);
      setRoomId(session.roomId);
      setPlayerId(session.playerId);
      setToken(session.token);
      if (body.gameState) {
        setGameState(body.gameState);
        setStep('game');
      } else {
        setStep('lobby');
      }
    })();
    return () => {
      run.abort();
    };
    // `resume` and `serverUrl` are fixed for the lifetime of this mount and
    // the setters are stable, so this runs exactly once.
  }, [resume, serverUrl, setLobbyState, setGameState, setStep, setRoomId, setPlayerId, setToken]);
}

interface RoomSyncOptions {
  serverUrl: string;
  roomId: string;
  token: string | null;
  playerId: string | null;
  room: RoomSetters;
  onBack: () => void;
  showError: ShowError;
}

// Keep local state in step with the server for the current room. All the
// transport mechanics (SSE vs version-skipping poll with backoff) live in
// the unit-tested `startRoomSync` engine; this hook only maps its
// callbacks onto React state. Re-runs when we join/create a room and have
// both a roomId and a token.
function useRoomSync(options: RoomSyncOptions) {
  const { serverUrl, roomId, token, playerId, onBack, showError } = options;
  const { setLobbyState, setGameState, setStep } = options.room;
  // Mirrors `playerId` for the room-sync callbacks, which live in an effect
  // keyed on [roomId, token] and would otherwise read a stale id.
  const playerIdRef = useRef<string | null>(null);
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);
  // Players the server reports as unheard-from. Arrives out-of-band from room
  // state (its own SSE event / poll field), so it is kept in its own state.
  const [disconnectedPlayerIds, setDisconnectedPlayerIds] = useState<string[]>([]);
  // False while the sync engine can't reach the server; drives the offline banner.
  const [connected, setConnected] = useState(true);
  const syncHandleRef = useRef<RoomSyncHandle | null>(null);

  const stopSync = useCallback(() => {
    syncHandleRef.current?.stop();
    syncHandleRef.current = null;
  }, []);

  useEffect(() => {
    if (!roomId || !token) return;

    const transport = supportsOnlineEventStream({
      platform: Platform.OS,
      eventSourceAvailable: typeof EventSource !== 'undefined',
    })
      ? 'sse'
      : 'poll';

    const handle = startRoomSync({
      serverUrl,
      roomId,
      token,
      transport,
      onLobbyState: (state) => {
        // Removed while away (the host dropped us after we went quiet): the
        // session is gone, so leave rather than sit on a dead screen. Judged on
        // the lobby roster only — bankrupt players stay in it (see the helper).
        if (wasRemovedFromRoom(state, playerIdRef.current)) {
          showError('You were removed from the game');
          // Stop syncing so the next update can't run this again while the
          // clear is pending, and leave only once the session is gone, so the
          // menu doesn't offer to resume it (#258).
          stopSync();
          void clearStoredSession().then(onBack);
          return;
        }
        setLobbyState(state);
        if (state.status === 'game' && state.gameState) {
          setGameState(state.gameState);
          setStep('game');
        } else if (transport === 'poll') {
          // Poll snapshots are authoritative about the current screen. The
          // SSE branch deliberately never moves a client back to the lobby
          // on a lobby-status update (matches the pre-extraction behavior).
          setStep('lobby');
        }
      },
      onGameState: setGameState,
      onPresence: setDisconnectedPlayerIds,
      onConnected: () => {
        setConnected(true);
      },
      onDisconnected: () => {
        setConnected(false);
      },
      onSessionExpired: () => {
        showError('Session expired');
        // The server answered 404 session_expired, so the stored session is
        // dead: drop it before leaving, or the menu offers a Resume that can
        // only fail (#258).
        stopSync();
        void clearStoredSession().then(onBack);
      },
    });
    syncHandleRef.current = handle;

    return () => {
      syncHandleRef.current = null;
      handle.stop();
    };
  }, [serverUrl, roomId, token, onBack, showError, stopSync, setLobbyState, setGameState, setStep]);

  return { connected, disconnectedPlayerIds, stopSync };
}

/**
 * The online session's room state: who we are, which room we're in, what the
 * server last told us, and which screen that puts us on. Resume and the
 * room sync both feed it.
 */
export function useOnlineRoom(serverUrl: string, initialMode: OnlineMode, onBack: () => void) {
  const { error, setTransientError } = useTransientError();
  const [lobbyState, setLobbyState] = useState<Nullable<LobbyState>>(null);
  const [gameState, setGameState] = useState<Nullable<GameState>>(null);
  // `playerId` is the public id (safe to render, sent to other players in
  // broadcasts). `token` is the private credential sent on every authenticated
  // request — it must never be rendered or logged.
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [step, setStep] = useState<OnlineStep>(initialMode === 'resume' ? 'resuming' : 'connect');
  const room = { setLobbyState, setGameState, setStep, setRoomId, setPlayerId, setToken };

  useResumeSession(serverUrl, initialMode === 'resume', onBack, room);
  const sync = useRoomSync({
    serverUrl,
    roomId,
    token,
    playerId,
    room,
    onBack,
    showError: setTransientError,
  });

  /**
   * Persist the session for future resume, then bring the joined-room
   * response into local state. This is the entry point that flips `step` to
   * 'lobby', and also triggers the room sync via the new `roomId` /
   * `token`. The write is awaited first: on native it is an async keychain /
   * keystore call, and if the app is killed before it lands the server keeps
   * the player while the device has nothing to resume from (#258).
   */
  const enterLobby = useCallback(async (body: JoinedRoomResponse) => {
    await writeStoredSession({
      roomId: body.roomId,
      playerId: body.playerId,
      token: body.token,
    });
    setRoomId(body.roomId);
    setPlayerId(body.playerId);
    setToken(body.token);
    setStep('lobby');
  }, []);

  return {
    ...sync,
    error,
    setTransientError,
    lobbyState,
    gameState,
    playerId,
    token,
    roomId,
    step,
    enterLobby,
  };
}
