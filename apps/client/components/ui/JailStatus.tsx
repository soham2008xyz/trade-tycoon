import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { Player } from '@trade-tycoon/game-logic';
import { getJailStatus } from '../jail-status';

interface Props {
  player: Pick<Player, 'isInJail' | 'jailTurns'>;
  showHint?: boolean;
}

/** Jail state is public, so every player can see it in either game mode. */
export const JailStatus: React.FC<Props> = ({ player, showHint = false }) => {
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

const styles = StyleSheet.create({
  root: { flexShrink: 1, gap: 4 },
  badge: {
    color: '#7c2d12',
    backgroundColor: '#fff7ed',
    borderColor: '#9a3412',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  hint: { color: '#7c2d12', fontSize: 12 },
});
