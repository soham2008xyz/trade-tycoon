import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { IconButton } from './ui/IconButton';

interface Props {
  onBack: () => void;
  onJoinRoom: () => void;
  onCreateRoom: () => void;
  onResumeGame: () => void;
}

interface StoredSession {
  roomId: string;
  userId: string;
}

/**
 * Try to read a previous session from localStorage on web. Returns null on
 * native (no localStorage), when nothing is stored, or when the stored value
 * is malformed. Kept loose-typed because the only field we display is roomId.
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

export const MultiplayerMenuScreen: React.FC<Props> = ({
  onBack,
  onJoinRoom,
  onCreateRoom,
  onResumeGame,
}) => {
  // Session detection runs once on mount. If the user navigates away and
  // comes back the menu remounts, so this stays fresh.
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  useEffect(() => {
    setSavedSession(readStoredSession());
  }, []);

  return (
    <View style={styles.modalContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>Online Multiplayer</Text>

        <View style={styles.buttonContainer}>
          {savedSession && (
            <IconButton
              title={`Resume Game (${savedSession.roomId})`}
              icon="play-circle"
              onPress={onResumeGame}
              style={styles.button}
            />
          )}
          <IconButton
            title="Create New Room"
            icon="plus-circle"
            onPress={onCreateRoom}
            style={styles.button}
          />
          <IconButton
            title="Join Existing Room"
            icon="login"
            onPress={onJoinRoom}
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
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    elevation: 5,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  button: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#666',
  },
});
