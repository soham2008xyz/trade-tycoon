import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { IconButton } from './ui/IconButton';
import { readStoredSession, type StoredSession } from './online-session';

interface Props {
  onBack: () => void;
  onJoinRoom: () => void;
  onCreateRoom: () => void;
  onResumeGame: () => void;
}

export const MultiplayerMenuScreen: React.FC<Props> = ({
  onBack,
  onJoinRoom,
  onCreateRoom,
  onResumeGame,
}) => {
  // Session detection runs once on mount. If the user navigates away and
  // comes back the menu remounts, so this stays fresh.
  const [savedSession] = useState<StoredSession | null>(() => readStoredSession(Platform.OS));

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
