import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from './ui/IconButton';
import type { StoredSession } from './online-session';
import { readStoredSession } from './session-storage';
import { useTheme } from '../hooks/useTheme';
import { useAndroidBack } from '../hooks/useAndroidBack';
import type { Theme } from '../constants/theme';

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
  const styles = createStyles(useTheme());
  useAndroidBack(onBack);
  // Session detection runs once on mount. If the user navigates away and
  // comes back the menu remounts, so this stays fresh. The read is async
  // (native storage is the keychain/keystore), so the Resume button appears
  // a moment after the menu does.
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  useEffect(() => {
    let cancelled = false;
    void readStoredSession().then((session) => {
      if (!cancelled) setSavedSession(session);
    });
    return () => {
      cancelled = true;
    };
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: 24,
    },
    content: {
      width: '90%',
      maxWidth: 460,
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 32,
      elevation: 5,
      boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 40,
      textAlign: 'center',
      color: theme.textPrimary,
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
      backgroundColor: theme.neutralButton,
    },
  });
