import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { DisconnectedBadge } from '../ui/DisconnectedBadge';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';
import { formatMoney } from '../format-money';

interface Props extends Pick<
  StatusPanelProps,
  | 'state'
  | 'myPlayerId'
  | 'disconnectedPlayerIds'
  | 'removablePlayerIds'
  | 'onRemovePlayer'
  | 'onOpenTrade'
> {
  /** The player whose turn it is, shown in bold. Undefined once the game is over. */
  activePlayerId: string | undefined;
  isGameOver: boolean;
}

/**
 * The tablet Players list with its Trade and Remove buttons. It sits in the
 * board centre, or in the strip under the board when the screen is tall enough
 * (see `getPlayerStripHeight`).
 */
export const PlayerList: React.FC<Props> = ({
  state,
  myPlayerId,
  activePlayerId,
  isGameOver,
  disconnectedPlayerIds,
  removablePlayerIds,
  onRemovePlayer,
  onOpenTrade,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.playerList}>
      <Text style={styles.sectionTitle}>Players</Text>
      {state.players.map((player) => (
        <View key={player.id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <View style={[styles.playerColor, { backgroundColor: player.color }]} />
            <View style={styles.playerLabel}>
              <Text
                style={[styles.playerText, activePlayerId === player.id && styles.activePlayerText]}
              >
                {player.name} ({formatMoney(player.money)}){state.winner === player.id ? ' 🏆' : ''}
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
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    playerList: { marginBottom: 15, width: '100%' },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 5,
      textAlign: 'center',
      color: theme.textPrimary,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      justifyContent: 'space-between',
    },
    // flex: 1 + shrinking label keeps the Trade button inside the 300px panel
    // when large Dynamic Type makes the name wrap.
    playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    playerLabel: {
      flexShrink: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 6,
    },
    playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2, flexShrink: 0 },
    // flexShrink lets a long "Name ($money)" wrap inside the label instead of
    // being clipped at large Dynamic Type.
    playerText: { fontSize: 14, flexShrink: 1, color: theme.textPrimary },
    activePlayerText: { fontWeight: 'bold' },
  });
