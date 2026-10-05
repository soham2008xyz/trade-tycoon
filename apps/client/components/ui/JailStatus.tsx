import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { Player } from '@trade-tycoon/game-logic';
import { getJailStatus } from '../jail-status';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface Props {
  player: Pick<Player, 'isInJail' | 'jailTurns'>;
  showHint?: boolean;
}

/** Jail state is public, so every player can see it in either game mode. */
export const JailStatus: React.FC<Props> = ({ player, showHint = false }) => {
  const styles = createStyles(useTheme());
  const status = getJailStatus(player);
  if (!status) return null;
  return (
    <View style={styles.root}>
      <Text accessibilityLabel={status.accessibilityLabel} style={styles.badge}>
        {status.text}
      </Text>
      {showHint && <Text style={styles.hint}>{status.hint}</Text>}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flexShrink: 1, gap: 4 },
    badge: {
      color: theme.jailText,
      backgroundColor: theme.jailBg,
      borderColor: theme.jailBorder,
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontSize: 12,
      fontWeight: '700',
    },
    hint: { color: theme.jailText, fontSize: 12 },
  });
