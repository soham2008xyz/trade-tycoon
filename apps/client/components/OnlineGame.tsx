import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import { GameUI } from './GameUI';
import { ConnectionBanner, ConnectionStatusProvider } from './ui/ConnectionBanner';
import { IconButton } from './ui/IconButton';
import { KeyboardAwareScreen } from './ui/KeyboardAwareScreen';
import { LobbyState, GameState, GameAction, limitPlayerNameInput } from '@trade-tycoon/game-logic';
import { getOnlineServerUrl, supportsOnlineEventStream } from './online-platform';
import { startRoomSync, type RoomSyncHandle } from './online-sync';
import { readStoredSession, writeStoredSession, clearStoredSession } from './session-storage';
import { validateConnectForm } from './online-form';
import { wasRemovedFromRoom } from './multiplayer-gating';
import {
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  startGame as apiStartGame,
  sendGameAction,
  reconnectToRoom,
  leaveRoom as apiLeaveRoom,
  removePlayer as apiRemovePlayer,
  type JoinedRoomResponse,
} from './online-api';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';

// `null` means: no EXPO_PUBLIC_SERVER_URL configured, production build,
// native platform — there's no safe host to guess (see online-platform.ts).
// The component checks for this before rendering the normal connect flow.
const SERVER_URL = getOnlineServerUrl({
  platform: Platform.OS,
  expoPublicServerUrl: process.env.EXPO_PUBLIC_SERVER_URL,
  isDev: __DEV__,
});

interface OnlineGameProps {
  /** Back to the multiplayer menu (form back buttons, lobby/mid-game leave). */
  onBack: () => void;
  /** Back to the main menu, from the game-over card. */
  onMainMenu: () => void;
  initialMode: 'create' | 'join' | 'resume';
}

export const OnlineGame: React.FC<OnlineGameProps> = ({ onBack, onMainMenu, initialMode }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  // `playerId` is the public id (safe to render, sent to other players in
  // broadcasts). `token` is the private credential sent on every authenticated
  // request — it must never be rendered or logged.
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
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
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [step, setStep] = useState<'connect' | 'lobby' | 'game' | 'resuming'>(
    initialMode === 'resume' ? 'resuming' : 'connect'
  );
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Form-validation message, kept apart from `error` (server/lobby errors,
  // which auto-expire): it's cleared on edit and only rendered on the connect
  // screen, so it can't linger or leak into the lobby (#252).
  const [formError, setFormError] = useState<string | null>(null);
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
    let cancelled = false;
    (async () => {
      const session = await readStoredSession();
      if (cancelled) return;
      if (!session) {
        onBack();
        return;
      }
      const result = await reconnectToRoom(SERVER_URL, session.roomId, session.token);
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 0) {
          // Network error: we don't know if the session is still valid —
          // leave the stored session alone and bounce so the user can retry.
          console.error('Resume failed:', result.error);
          onBack();
          return;
        }
        // 404 session_expired, or any other failure — drop the session and exit.
        // Awaited so the menu we return to doesn't read it back (#258).
        await clearStoredSession();
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
        // Removed while away (the host dropped us after we went quiet): the
        // session is gone, so leave rather than sit on a dead screen. Judged on
        // the lobby roster only — bankrupt players stay in it (see the helper).
        if (wasRemovedFromRoom(state, playerIdRef.current)) {
          setTransientError('You were removed from the game');
          // Stop syncing so the next update can't run this again while the
          // clear is pending, and leave only once the session is gone, so the
          // menu doesn't offer to resume it (#258).
          syncHandleRef.current?.stop();
          syncHandleRef.current = null;
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
        setTransientError('Session expired');
        // The server answered 404 session_expired, so the stored session is
        // dead: drop it before leaving, or the menu offers a Resume that can
        // only fail (#258).
        syncHandleRef.current?.stop();
        syncHandleRef.current = null;
        void clearStoredSession().then(onBack);
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
    const validationError = validateConnectForm('create', playerName, inputRoomId);
    setFormError(validationError);
    if (validationError) return;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await apiCreateRoom(SERVER_URL, playerName.trim());
      if (!result.ok) {
        setTransientError(result.error);
        return;
      }
      await enterLobby(result.data);
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (SERVER_URL === null) return;
    const validationError = validateConnectForm('join', playerName, inputRoomId);
    setFormError(validationError);
    if (validationError) return;
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
      await enterLobby({ ...result.data, roomId: result.data.roomId || targetRoomId });
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

  const handleRemovePlayer = useCallback(
    async (targetPlayerId: string) => {
      if (!token || !roomId || SERVER_URL === null) return;
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      setBusy(true);
      try {
        const result = await apiRemovePlayer(SERVER_URL, roomId, token, targetPlayerId);
        if (!result.ok) {
          // e.g. 409 "Player is still connected" if they came back meanwhile.
          setTransientError(result.error);
        }
        // On success the resulting lobby_update arrives through the sync.
      } finally {
        requestInFlightRef.current = false;
        setBusy(false);
      }
    },
    [roomId, token, setTransientError]
  );

  const leaveRoom = useCallback(
    async (then: () => void) => {
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

      await clearStoredSession();
      then();
    },
    [roomId, token]
  );

  const handleLeave = useCallback(() => leaveRoom(onBack), [leaveRoom, onBack]);

  // A finished game can't be restarted from its room (see `canStartNewGame`),
  // so the game-over card's "Back to Menu" goes all the way to the main menu,
  // matching hotseat, instead of the multiplayer menu (#324).
  const handleBackToMainMenu = useCallback(() => leaveRoom(onMainMenu), [leaveRoom, onMainMenu]);

  /**
   * Persist the session for future resume, then bring the joined-room
   * response into local state. This is the entry point that flips `step` to
   * 'lobby', and also triggers the SSE useEffect via the new `roomId` /
   * `token`. The write is awaited first: on native it is an async keychain /
   * keystore call, and if the app is killed before it lands the server keeps
   * the player while the device has nothing to resume from (#258).
   */
  async function enterLobby(body: JoinedRoomResponse) {
    await writeStoredSession({
      roomId: body.roomId,
      playerId: body.playerId,
      token: body.token,
    });
    setRoomId(body.roomId);
    setPlayerId(body.playerId);
    setToken(body.token);
    setStep('lobby');
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
      <KeyboardAwareScreen style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{initialMode === 'create' ? 'Create Room' : 'Join Room'}</Text>

          <TextInput
            style={styles.input}
            nativeID="online-player-name"
            accessibilityLabel="Your name"
            placeholder="Your Name"
            placeholderTextColor={theme.textMuted}
            keyboardAppearance={theme.scheme}
            value={playerName}
            onChangeText={(text) => {
              setPlayerName(limitPlayerNameInput(text));
              setFormError(null);
            }}
          />

          {initialMode === 'join' && (
            <TextInput
              style={styles.input}
              nativeID="online-room-code"
              accessibilityLabel="Room code"
              placeholder="Room Code (e.g. ABCD123)"
              placeholderTextColor={theme.textMuted}
              keyboardAppearance={theme.scheme}
              value={inputRoomId}
              onChangeText={(text) => {
                setInputRoomId(text.toUpperCase());
                setFormError(null);
              }}
              autoCapitalize="characters"
            />
          )}

          {(formError ?? error) && <Text style={styles.error}>{formError ?? error}</Text>}

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
      </KeyboardAwareScreen>
    );
  }

  if (step === 'lobby') {
    const isHost = lobbyState?.players.find((p) => p.id === playerId)?.isHost;

    return (
      <ConnectionStatusProvider connected={connected}>
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
          <ConnectionBanner floating />
        </View>
      </ConnectionStatusProvider>
    );
  }

  if (step === 'game' && gameState) {
    return (
      <ConnectionStatusProvider connected={connected}>
        <GameUI
          state={gameState}
          currentPlayerId={playerId || ''}
          onDispatch={handleGameDispatch}
          uiToastMessage={uiToastMessage ?? error}
          setUiToastMessage={setUiToastMessage}
          onLeaveGame={handleLeave}
          onBackToMenu={handleBackToMainMenu}
          isMultiplayer={true}
          disconnectedPlayerIds={disconnectedPlayerIds}
          hostId={lobbyState?.players.find((p) => p.isHost)?.id}
          onRemovePlayer={handleRemovePlayer}
        />
      </ConnectionStatusProvider>
    );
  }

  return <Text style={styles.subtitle}>Loading...</Text>;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 24,
      alignItems: 'center',
      boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: theme.textPrimary,
    },
    subtitle: {
      fontSize: 18,
      marginBottom: 10,
      alignSelf: 'flex-start',
      color: theme.textPrimary,
    },
    input: {
      width: '100%',
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
      fontSize: 16,
      color: theme.textPrimary,
      backgroundColor: theme.surface,
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
      backgroundColor: theme.neutralButton,
      marginTop: 10,
    },
    error: {
      color: theme.errorText,
      marginBottom: 10,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    colorDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
    },
    playerText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    spacer: {
      height: 20,
    },
    waitingText: {
      fontStyle: 'italic',
      color: theme.textSecondary,
      marginBottom: 20,
    },
  });
