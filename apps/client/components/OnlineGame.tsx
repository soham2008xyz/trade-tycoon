import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import { GameUI } from './GameUI';
import { IconButton } from './ui/IconButton';
import { LobbyState, GameState, GameAction } from '@trade-tycoon/game-logic';

const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  (Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.0.2.2:3001');

interface OnlineGameProps {
  onBack: () => void;
  initialMode: 'create' | 'join' | 'resume';
}

interface JoinedRoomResponse {
  roomId: string;
  userId: string;
  isHost: boolean;
}

interface ReconnectResponse {
  lobby: LobbyState;
  gameState: GameState | null;
}

interface StoredSession {
  roomId: string;
  userId: string;
}

/**
 * Read the saved session from localStorage. Returns null on web platforms
 * without a session, on native (no localStorage), or if the stored value is
 * malformed.
 */
const readStoredSession = (): StoredSession | null => {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem('trade_tycoon_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed || typeof parsed.roomId !== 'string' || typeof parsed.userId !== 'string') {
      return null;
    }
    return { roomId: parsed.roomId, userId: parsed.userId };
  } catch {
    return null;
  }
};

/**
 * Read a JSON error message from a non-OK fetch response, falling back to a
 * sensible default. Server endpoints return { error: '...' }.
 */
const readError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // Body wasn't JSON.
  }
  return fallback;
};

export const OnlineGame: React.FC<OnlineGameProps> = ({ onBack, initialMode }) => {
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [step, setStep] = useState<'connect' | 'lobby' | 'game' | 'resuming'>(
    initialMode === 'resume' ? 'resuming' : 'connect'
  );
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Resume flow: validate the stored session against the server before
  // hydrating local state. If the room/user is gone (server restart, room
  // expired, host kicked the player), drop the stored session and bounce the
  // user back to the previous screen so they can start fresh.
  useEffect(() => {
    if (initialMode !== 'resume') return;
    const session = readStoredSession();
    if (!session) {
      onBack();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SERVER_URL}/api/rooms/${encodeURIComponent(session.roomId)}/reconnect`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId }),
          }
        );
        if (cancelled) return;
        if (!res.ok) {
          // 404 from the server with body { error: 'session_expired' }, or
          // any other failure — drop the session and exit.
          if (Platform.OS === 'web') localStorage.removeItem('trade_tycoon_session');
          onBack();
          return;
        }
        const body = (await res.json()) as ReconnectResponse;
        setLobbyState(body.lobby);
        setRoomId(session.roomId);
        setUserId(session.userId);
        if (body.gameState) {
          setGameState(body.gameState);
          setStep('game');
        } else {
          setStep('lobby');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Resume failed', err);
        // Network errors mean we don't know if the session is still valid —
        // leave localStorage alone and bounce so the user can retry.
        onBack();
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialMode is constant for the lifetime of this mount; eslint can't
    // see that, but we deliberately want this to run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to the server's SSE stream for the current room. Re-runs when we
  // join/create a room and we have both a roomId and userId.
  useEffect(() => {
    if (!roomId || !userId || typeof EventSource === 'undefined') return;

    const url = `${SERVER_URL}/api/rooms/${encodeURIComponent(
      roomId
    )}/events?userId=${encodeURIComponent(userId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const onLobby = (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data) as LobbyState;
        setLobbyState(state);
        if (state.status === 'game' && state.gameState) {
          setGameState(state.gameState);
          setStep('game');
        }
      } catch (err) {
        console.error('Bad lobby_update payload', err);
      }
    };
    const onGame = (e: MessageEvent) => {
      try {
        setGameState(JSON.parse(e.data) as GameState);
      } catch (err) {
        console.error('Bad game_state_update payload', err);
      }
    };

    es.addEventListener('lobby_update', onLobby);
    es.addEventListener('game_state_update', onGame);
    es.onerror = () => {
      // EventSource auto-reconnects on its own; we just log so the user can
      // see what's happening if they have devtools open.
      console.warn('SSE connection hiccup; browser will retry automatically');
    };

    return () => {
      es.removeEventListener('lobby_update', onLobby);
      es.removeEventListener('game_state_update', onGame);
      es.close();
      eventSourceRef.current = null;
    };
  }, [roomId, userId]);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      if (!res.ok) {
        setTransientError(await readError(res, 'Failed to create room'));
        return;
      }
      const body = (await res.json()) as JoinedRoomResponse;
      enterLobby(body);
    } catch (err) {
      console.error(err);
      setTransientError('Network error: could not reach server');
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim() || !inputRoomId.trim()) {
      setError('Please enter name and room code');
      return;
    }
    const targetRoomId = inputRoomId.trim().toUpperCase();
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(targetRoomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      if (!res.ok) {
        setTransientError(await readError(res, 'Could not join room'));
        return;
      }
      const body = (await res.json()) as JoinedRoomResponse;
      // Server already normalized the room id, but make sure we use the
      // exact value it returned for SSE / future requests.
      enterLobby({ ...body, roomId: body.roomId || targetRoomId });
    } catch (err) {
      console.error(err);
      setTransientError('Network error: could not reach server');
    }
  };

  const handleStartGame = async () => {
    if (!userId || !roomId) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        setTransientError(await readError(res, 'Failed to start game'));
      }
      // The actual transition to step='game' happens via the SSE stream when
      // it delivers the lobby_update with status='game'.
    } catch (err) {
      console.error(err);
      setTransientError('Network error: could not reach server');
    }
  };

  const handleGameDispatch = async (action: GameAction) => {
    if (!userId || !roomId) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      if (!res.ok) {
        setTransientError(await readError(res, 'Action rejected'));
      }
    } catch (err) {
      console.error(err);
      setTransientError('Network error: could not reach server');
    }
  };

  const handleLeave = async () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    if (roomId && userId) {
      try {
        await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.error('Leave request failed', err);
      }
    }

    if (Platform.OS === 'web') {
      localStorage.removeItem('trade_tycoon_session');
    }
    onBack();
  };

  /** Centralized helper so a 200ms transient toast doesn't accumulate timers. */
  function setTransientError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  /**
   * Bring the joined-room response from the REST call into local state and
   * persist the session for future resume. This is the entry point that flips
   * `step` to 'lobby', and also triggers the SSE useEffect via the new
   * `roomId` / `userId`.
   */
  function enterLobby(body: JoinedRoomResponse) {
    setRoomId(body.roomId);
    setUserId(body.userId);
    setStep('lobby');
    if (Platform.OS === 'web') {
      localStorage.setItem(
        'trade_tycoon_session',
        JSON.stringify({ roomId: body.roomId, userId: body.userId })
      );
    }
  }

  // Render Logic
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
            placeholder="Your Name"
            value={playerName}
            onChangeText={setPlayerName}
          />

          {initialMode === 'join' && (
            <TextInput
              style={styles.input}
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
    const isHost = lobbyState?.players.find((p) => p.id === userId)?.isHost;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Room: {roomId}</Text>
          <Text style={styles.subtitle}>Players:</Text>
          {lobbyState?.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={[styles.colorDot, { backgroundColor: p.color }]} />
              <Text style={styles.playerText}>
                {p.name} {p.isHost ? '(Host)' : ''} {p.id === userId ? '(You)' : ''}
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
              disabled={!lobbyState || lobbyState.players.length < 2}
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
        currentPlayerId={userId || ''}
        onDispatch={handleGameDispatch}
        uiToastMessage={uiToastMessage || error}
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
    backgroundColor: '#333',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
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
