import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { GameUI } from './GameUI';
import { IconButton } from './ui/IconButton';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyState,
  GameState,
  GameAction,
} from '@trade-tycoon/game-logic';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || (Platform.OS === 'web' ? 'http://localhost:3001' : 'http://10.0.2.2:3001');

interface OnlineGameProps {
  onBack: () => void;
  initialMode: 'create' | 'join';
}

export const OnlineGame: React.FC<OnlineGameProps> = ({ onBack, initialMode }) => {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [step, setStep] = useState<'connect' | 'lobby' | 'game'>('connect');
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Socket
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('lobby_update', (state) => {
      setLobbyState(state);
      if (state.status === 'game' && state.gameState) {
        setGameState(state.gameState);
        setStep('game');
      } else if (step === 'connect') {
        // If we reconnect to a lobby, ensure we show the lobby screen
        setStep('lobby');
      }
    });

    newSocket.on('game_state_update', (state) => {
      setGameState(state);
    });

    newSocket.on('joined_room', ({ roomId, userId, isHost }) => {
      setRoomId(roomId);
      setUserId(userId);
      setStep('lobby');

      // Persist session
      if (Platform.OS === 'web') {
        localStorage.setItem('trade_tycoon_session', JSON.stringify({ roomId, userId }));
      }
    });

    newSocket.on('error', (msg) => {
      setError(msg);
      // Clear error after 3s
      setTimeout(() => setError(null), 3000);
    });

    // Check for existing session
    if (Platform.OS === 'web') {
      const session = localStorage.getItem('trade_tycoon_session');
      if (session) {
        try {
          const { roomId, userId } = JSON.parse(session);
          newSocket.emit('reconnect', roomId, userId);
          // We optimistically set ID, but we wait for lobby_update to confirm
          setUserId(userId);
          setRoomId(roomId);
        } catch (e) {
          console.error("Invalid session", e);
        }
      }
    }

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    socket?.emit('create_room', playerName);
  };

  const handleJoin = () => {
    if (!playerName.trim() || !inputRoomId.trim()) {
      setError('Please enter name and room code');
      return;
    }
    socket?.emit('join_room', inputRoomId.toUpperCase(), playerName);
  };

  const handleStartGame = () => {
    if (userId && roomId) {
      socket?.emit('start_game', roomId, userId);
    }
  };

  const handleGameDispatch = (action: GameAction) => {
    if (userId && roomId) {
      socket?.emit('game_action', roomId, userId, action);
    }
  };

  const handleLeave = () => {
      if (Platform.OS === 'web') {
          localStorage.removeItem('trade_tycoon_session');
      }
      onBack();
  };

  // Render Logic
  if (step === 'connect') {
    // If we are auto-reconnecting (waiting for socket), we might want a spinner?
    // But here we present the Create/Join UI if not reconnected.

    // We can check if we tried reconnecting logic?
    // For simplicity, we just show form. If reconnect works, it will jump to lobby/game.

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
              onChangeText={text => setInputRoomId(text.toUpperCase())}
              autoCapitalize="characters"
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <IconButton
              title={initialMode === 'create' ? "Create" : "Join"}
              icon={initialMode === 'create' ? "plus" : "login"}
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
      const isHost = lobbyState?.players.find(p => p.id === userId)?.isHost;

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
  }
});
