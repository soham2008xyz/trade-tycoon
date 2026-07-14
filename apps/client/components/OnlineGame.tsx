import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import { GameUI } from './GameUI';
import { IconButton } from './ui/IconButton';
import { LobbyState, GameState, GameAction } from '@trade-tycoon/game-logic';
import { getOnlineServerUrl, supportsOnlineEventStream } from './online-platform';
import { startRoomSync, type RoomSyncHandle } from './online-sync';
import { readStoredSession, writeStoredSession, clearStoredSession } from './online-session';
import {
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  startGame as apiStartGame,
  sendGameAction,
  reconnectToRoom,
  leaveRoom as apiLeaveRoom,
  type JoinedRoomResponse,
} from './online-api';

// `null` means: no EXPO_PUBLIC_SERVER_URL configured, production build,
// native platform — there's no safe host to guess (see online-platform.ts).
// The component checks for this before rendering the normal connect flow.
const SERVER_URL = getOnlineServerUrl({
  platform: Platform.OS,
  expoPublicServerUrl: process.env.EXPO_PUBLIC_SERVER_URL,
  isDev: __DEV__,
});

interface OnlineGameProps {
  onBack: () => void;
  initialMode: 'create' | 'join' | 'resume';
}

export const OnlineGame: React.FC<OnlineGameProps> = ({ onBack, initialMode }) => {
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  // `playerId` is the public id (safe to render, sent to other players in
  // broadcasts). `token` is the private credential sent on every authenticated
  // request — it must never be rendered or logged.
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [step, setStep] = useState<'connect' | 'lobby' | 'game' | 'resuming'>(
    initialMode === 'resume' ? 'resuming' : 'connect'
  );
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncHandleRef = useRef<RoomSyncHandle | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards create/join/start/action requests against double-submission (a
  // fast double-tap, or a tap registering twice on some platforms) firing
  // two POSTs for what the user intended as one action. The ref is the
  // synchronous guard (state updates are async, so a double-tap could slip
  // between them); `busy` mirrors it as state purely so buttons can render
  // disabled while a request is pending.
  const requestInFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  /** Centralized helper so a 200ms transient toast doesn't accumulate timers. */
  const setTransientError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Resume flow: validate the stored session against the server before
  // hydrating local state. If the room/token is gone (server restart, room
  // expired, host kicked the player), drop the stored session and bounce the
  // user back to the previous screen so they can start fresh.
  useEffect(() => {
    // Deliberately `=== null`, not a truthy check: `''` is the intended
    // same-origin sentinel for an unconfigured production web build (see
    // online-platform.ts) and must be treated as configured.
    if (initialMode !== 'resume' || SERVER_URL === null) return;
    const session = readStoredSession(Platform.OS);
    if (!session) {
      onBack();
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await reconnectToRoom(SERVER_URL, session.roomId, session.token);
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 0) {
          // Network error: we don't know if the session is still valid —
          // leave localStorage alone and bounce so the user can retry.
          console.error('Resume failed:', result.error);
          onBack();
          return;
        }
        // 404 session_expired, or any other failure — drop the session and exit.
        clearStoredSession(Platform.OS);
        onBack();
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
      cancelled = true;
    };
    // initialMode is constant for the lifetime of this mount; eslint can't
    // see that, but we deliberately want this to run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep local state in step with the server for the current room. All the
  // transport mechanics (SSE vs version-skipping poll with backoff) live in
  // the unit-tested `startRoomSync` engine; this effect only maps its
  // callbacks onto React state. Re-runs when we join/create a room and have
  // both a roomId and a token.
  useEffect(() => {
    if (!roomId || !token || SERVER_URL === null) return;

    const transport = supportsOnlineEventStream({
      platform: Platform.OS,
      eventSourceAvailable: typeof EventSource !== 'undefined',
    })
      ? 'sse'
      : 'poll';

    const handle = startRoomSync({
      serverUrl: SERVER_URL,
      roomId,
      token,
      transport,
      onLobbyState: (state) => {
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
      onSessionExpired: () => {
        setTransientError('Session expired');
        onBack();
      },
    });
    syncHandleRef.current = handle;

    return () => {
      syncHandleRef.current = null;
      handle.stop();
    };
  }, [roomId, token, onBack, setTransientError]);

  const handleCreate = async () => {
    if (SERVER_URL === null) return;
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await apiCreateRoom(SERVER_URL, playerName.trim());
      if (!result.ok) {
        setTransientError(result.error);
        return;
      }
      enterLobby(result.data);
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (SERVER_URL === null) return;
    if (!playerName.trim() || !inputRoomId.trim()) {
      setError('Please enter name and room code');
      return;
    }
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    const targetRoomId = inputRoomId.trim().toUpperCase();
    try {
      const result = await apiJoinRoom(SERVER_URL, targetRoomId, playerName.trim());
      if (!result.ok) {
        setTransientError(result.error);
        return;
      }
      // Server already normalized the room id, but make sure we use the
      // exact value it returned for SSE / future requests.
      enterLobby({ ...result.data, roomId: result.data.roomId || targetRoomId });
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleStartGame = async () => {
    if (!token || !roomId || SERVER_URL === null) return;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await apiStartGame(SERVER_URL, roomId, token);
      if (!result.ok) {
        setTransientError(result.error);
      }
      // The actual transition to step='game' happens via the SSE stream when
      // it delivers the lobby_update with status='game'.
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  // Stable identity matters for the two callbacks handed to GameUI
  // (onDispatch/onLeaveGame): they feed its memoized sharedProps, and a fresh
  // closure per render would defeat the Board/Tile memoization downstream.
  const handleGameDispatch = useCallback(
    async (action: GameAction) => {
      if (!token || !roomId || SERVER_URL === null) return;
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      setBusy(true);
      try {
        const result = await sendGameAction(SERVER_URL, roomId, token, action);
        if (!result.ok) {
          setTransientError(result.error);
        }
      } finally {
        requestInFlightRef.current = false;
        setBusy(false);
      }
    },
    [roomId, token, setTransientError]
  );

  const handleLeave = useCallback(async () => {
    // Stop the stream/poll before the leave POST so its own lobby_update
    // (or a poll racing it) can't resurrect state we're abandoning.
    syncHandleRef.current?.stop();
    syncHandleRef.current = null;

    if (roomId && token && SERVER_URL !== null) {
      const result = await apiLeaveRoom(SERVER_URL, roomId, token);
      if (!result.ok) {
        console.error('Leave request failed:', result.error);
      }
    }

    clearStoredSession(Platform.OS);
    onBack();
  }, [roomId, token, onBack]);

  /**
   * Bring the joined-room response from the REST call into local state and
   * persist the session for future resume. This is the entry point that flips
   * `step` to 'lobby', and also triggers the SSE useEffect via the new
   * `roomId` / `token`.
   */
  function enterLobby(body: JoinedRoomResponse) {
    setRoomId(body.roomId);
    setPlayerId(body.playerId);
    setToken(body.token);
    setStep('lobby');
    writeStoredSession(Platform.OS, {
      roomId: body.roomId,
      playerId: body.playerId,
      token: body.token,
    });
  }

  // Render Logic
  if (SERVER_URL === null) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Online Play Unavailable</Text>
          <Text style={styles.waitingText}>
            This build isn&apos;t configured with a server address, so online play can&apos;t
            connect. Contact the app developer.
          </Text>
          <IconButton
            title="Back"
            icon="arrow-left"
            onPress={onBack}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    );
  }

  if (step === 'resuming') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Resuming…</Text>
          <Text style={styles.waitingText}>
            Reconnecting to your last room. If it can&apos;t be found we&apos;ll send you back.
          </Text>
        </View>
      </View>
    );
  }

  if (step === 'connect') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{initialMode === 'create' ? 'Create Room' : 'Join Room'}</Text>

          <TextInput
            style={styles.input}
            nativeID="online-player-name"
            accessibilityLabel="Your name"
            placeholder="Your Name"
            value={playerName}
            onChangeText={setPlayerName}
          />

          {initialMode === 'join' && (
            <TextInput
              style={styles.input}
              nativeID="online-room-code"
              accessibilityLabel="Room code"
              placeholder="Room Code (e.g. ABCD123)"
              value={inputRoomId}
              onChangeText={(text) => setInputRoomId(text.toUpperCase())}
              autoCapitalize="characters"
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <IconButton
              title={initialMode === 'create' ? 'Create' : 'Join'}
              icon={initialMode === 'create' ? 'plus' : 'login'}
              onPress={initialMode === 'create' ? handleCreate : handleJoin}
              style={styles.button}
              disabled={busy}
            />
            <IconButton
              title="Back"
              icon="arrow-left"
              onPress={onBack}
              style={styles.secondaryButton}
            />
          </View>
        </View>
      </View>
    );
  }

  if (step === 'lobby') {
    const isHost = lobbyState?.players.find((p) => p.id === playerId)?.isHost;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Room: {roomId}</Text>
          <Text style={styles.subtitle}>Players:</Text>
          {lobbyState?.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={[styles.colorDot, { backgroundColor: p.color }]} />
              <Text style={styles.playerText}>
                {p.name} {p.isHost ? '(Host)' : ''} {p.id === playerId ? '(You)' : ''}
              </Text>
            </View>
          ))}

          <View style={styles.spacer} />

          {isHost ? (
            <IconButton
              title="Start Game"
              icon="play"
              onPress={handleStartGame}
              style={styles.button}
              disabled={busy || !lobbyState || lobbyState.players.length < 2}
            />
          ) : (
            <Text style={styles.waitingText}>Waiting for host to start...</Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <IconButton
            title="Leave"
            icon="close"
            onPress={handleLeave}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    );
  }

  if (step === 'game' && gameState) {
    return (
      <GameUI
        state={gameState}
        currentPlayerId={playerId || ''}
        onDispatch={handleGameDispatch}
        uiToastMessage={uiToastMessage ?? error}
        setUiToastMessage={setUiToastMessage}
        onLeaveGame={handleLeave}
        isMultiplayer={true}
      />
    );
  }

  return <Text>Loading...</Text>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 24,
  },
  card: {
    width: '90%',
    maxWidth: 460,
    backgroundColor: '#f8fbff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#666',
    marginTop: 10,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  playerText: {
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
  waitingText: {
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 20,
  },
});
