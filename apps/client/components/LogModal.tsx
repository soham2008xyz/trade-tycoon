import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Player } from '@trade-tycoon/game-logic';
import { PlayerMarker } from './PlayerMarker';
import { CloseButton } from './ui/CloseButton';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { useGameLayout } from '../hooks/useGameLayout';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';

interface Props {
  visible: boolean;
  logs: string[];
  players: Player[];
  onClose: () => void;
  /** Toasts to draw above the modal while it is open (see `FullScreenModalShell`). */
  overlay?: React.ReactNode;
}

type Styles = ReturnType<typeof createStyles>;

// Log lines start with "[Player name]"; tint the row with that player's colour.
const getLogColor = (log: string, players: Player[]): string | undefined => {
  const end = log.indexOf(']');
  if (!log.startsWith('[') || end < 0) return undefined;
  const name = log.slice(1, end);
  return players.find((p) => p.name === name)?.color;
};

interface LogEntryProps {
  log: string;
  players: Player[];
  styles: Styles;
}

const LogEntry: React.FC<LogEntryProps> = ({ log, players, styles }) => {
  const color = getLogColor(log, players);
  return (
    <View style={styles.logItem}>
      {color && <PlayerMarker color={color} size={16} style={styles.playerColorIndicator} />}
      <Text style={styles.logText}>{log}</Text>
    </View>
  );
};

export const LogModal: React.FC<Props> = ({ visible, logs, players, onClose, overlay }) => {
  const styles = createStyles(useTheme());
  // On phone the shell already draws the title + close button and fills the
  // screen, so the legacy overlay chrome (grey backdrop, floating card, own
  // header/✕) would duplicate it. Wide layouts get a bare transparent Modal
  // from the shell, so there the card still owns all of that.
  const isPhone = useGameLayout() === 'phone';

  return (
    <FullScreenModalShell visible={visible} onClose={onClose} title="Game Log" overlay={overlay}>
      <View style={isPhone ? styles.phoneContainer : styles.modalContainer}>
        <View style={isPhone ? styles.phoneContent : styles.content}>
          {!isPhone && (
            <View style={styles.header}>
              <Text style={styles.title}>Game Log</Text>
              <View style={styles.closeBtnContainer}>
                <CloseButton onPress={onClose} />
              </View>
            </View>
          )}

          <ScrollView style={isPhone ? undefined : styles.logList}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No logs yet.</Text>
            ) : (
              logs.map((log, index) => (
                <LogEntry key={index} log={log} players={players} styles={styles} />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </FullScreenModalShell>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    phoneContainer: { flex: 1, backgroundColor: theme.surface },
    phoneContent: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.scrim,
    },
    content: {
      width: '90%',
      maxWidth: 600,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
      maxHeight: '90%',
      flex: 1,
      elevation: 5,
      boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      position: 'relative',
      minHeight: 40,
    },
    closeBtnContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.textPrimary,
    },
    logList: {
      marginBottom: 20,
    },
    logItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    playerColorIndicator: {
      marginRight: 8,
    },
    logText: {
      fontSize: 16,
      color: theme.textPrimary,
      flexShrink: 1, // Allow text to wrap if it's too long
    },
    emptyText: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: 20,
    },
  });
