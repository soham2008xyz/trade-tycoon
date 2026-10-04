import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

export const Expanded: React.FC<StatusPanelProps> = ({
  state,
  myPlayerId,
  onShowLog,
  onRestart,
  onOpenTrade,
}) => {
  const { currentPlayer, isGameOver } = useStatusPanelActions(state, myPlayerId);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.sectionTitle}>Players</Text>
      {state.players.map((player) => (
        <View key={player.id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <View style={[styles.playerColor, { backgroundColor: player.color }]} />
            <View style={styles.playerLabel}>
              <Text
                style={[
                  styles.playerText,
                  currentPlayer?.id === player.id && styles.activePlayerText,
                ]}
              >
                {player.name} (${player.money}){state.winner === player.id ? ' 🏆 Winner' : ''}
              </Text>
              <GOOJBadge count={player.getOutOfJailCards} />
            </View>
          </View>
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
        <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
        {/* Peek's game-over card already offers New Game / Back to Menu. */}
        {!isGameOver && (
          <IconButton
            title="Restart"
            icon="restart"
            onPress={onRestart}
            color="#666"
            size="small"
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 36, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
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
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2, flexShrink: 0 },
  playerText: { fontSize: 14 },
  activePlayerText: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  footerRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
