import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { DisconnectedBadge } from '../ui/DisconnectedBadge';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';
import { formatMoney } from '../format-money';
import { PlayerMarker } from '../PlayerMarker';

export const Expanded: React.FC<StatusPanelProps & { scrollable?: boolean }> = (props) => {
  const {
    state,
    myPlayerId,
    onShowLog,
    onRestart,
    onOpenTrade,
    disconnectedPlayerIds,
    removablePlayerIds,
    onRemovePlayer,
    scrollable = true,
  } = props;
  const theme = useTheme();
  const styles = createStyles(theme);
  const { currentPlayer, isGameOver } = useStatusPanelActions(state, myPlayerId);

  const content = (
    <>
      <Text style={styles.sectionTitle}>Players</Text>
      {state.players.map((player) => (
        <View key={player.id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <PlayerMarker color={player.color} size={16} style={styles.playerColor} />
            <View style={styles.playerLabel}>
              <Text
                style={[
                  styles.playerText,
                  currentPlayer?.id === player.id && styles.activePlayerText,
                ]}
              >
                {player.name} ({formatMoney(player.money)})
                {state.winner === player.id ? ' 🏆 Winner' : ''}
              </Text>
              <GOOJBadge count={player.getOutOfJailCards} />
              <JailStatus player={player} />
              {disconnectedPlayerIds.includes(player.id) && (
                <DisconnectedBadge name={player.name} />
              )}
            </View>
          </View>
          {removablePlayerIds.includes(player.id) && (
            <View style={{ marginLeft: 10 }}>
              <IconButton
                title="Remove"
                icon="account-remove"
                onPress={() => onRemovePlayer(player.id)}
                color={theme.danger}
                size="small"
              />
            </View>
          )}
          {/* The reducer ignores PROPOSE_TRADE after a win. */}
          {!isGameOver && player.id !== myPlayerId && (
            <View style={{ marginLeft: 10 }}>
              <IconButton
                title="Trade"
                icon="handshake"
                onPress={() => onOpenTrade(player.id)}
                size="small"
              />
            </View>
          )}
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <IconButton
          title="Log"
          icon="script-text"
          onPress={onShowLog}
          color={theme.neutralButton}
          size="small"
        />
        {/* Peek's game-over card already offers New Game / Back to Menu. */}
        {!isGameOver && (
          <IconButton
            title="Restart"
            icon="restart"
            onPress={onRestart}
            color={theme.neutralButton}
            size="small"
          />
        )}
      </View>
    </>
  );

  // A sheet-integrated parent owns scrolling in the jail view. A nested
  // ScrollView would intercept its gestures and constrain the player list.
  return scrollable ? (
    <ScrollView contentContainerStyle={styles.root}>{content}</ScrollView>
  ) : (
    <View style={styles.root}>{content}</View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { padding: 12, paddingBottom: 36, gap: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: theme.textPrimary },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    // flex: 1 + shrinking label keeps the Trade button on-screen when large
    // Dynamic Type makes the name wrap onto several lines.
    playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    playerLabel: {
      flexShrink: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 6,
    },
    playerColor: { marginRight: 6 },
    playerText: { fontSize: 14, color: theme.textPrimary },
    activePlayerText: { fontWeight: '700' },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
    footerRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  });
