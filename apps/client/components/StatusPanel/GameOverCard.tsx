import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton } from '../ui/IconButton';
import { getGameOverSummary, getGameOverTitle } from '../game-over';
import { canStartNewGame } from '../multiplayer-gating';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

type Props = Pick<
  StatusPanelProps,
  'state' | 'myPlayerId' | 'isMultiplayer' | 'onNewGame' | 'onBackToMenu'
>;

/**
 * Persistent game-over summary shared by the phone peek and the tablet board
 * centre. It lives in the layout tree (not a Modal) on purpose: the usual
 * path to a win is confirming Declare Bankruptcy in a CustomAlert Modal, and
 * presenting a second Modal while that one is still dismissing can fail to
 * appear on iOS.
 */
export const GameOverCard: React.FC<Props> = ({
  state,
  myPlayerId,
  isMultiplayer,
  onNewGame,
  onBackToMenu,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const summary = getGameOverSummary(state);
  if (!summary) return null;

  const showNewGame = canStartNewGame(isMultiplayer) && !!onNewGame;
  const propertyLabel = summary.propertyCount === 1 ? 'property' : 'properties';

  return (
    <View style={styles.root} accessibilityRole="summary">
      <View style={styles.headline}>
        <MaterialCommunityIcons name="trophy" size={26} color={theme.warning} />
        <View style={[styles.dot, { backgroundColor: summary.color }]} />
        <Text style={styles.title}>{getGameOverTitle(summary, myPlayerId, isMultiplayer)}</Text>
      </View>
      <Text style={styles.stats}>
        Game over · ${summary.cash} cash · {summary.propertyCount} {propertyLabel}
      </Text>
      <View style={styles.actions}>
        {showNewGame && <IconButton title="New Game" icon="restart" onPress={onNewGame} />}
        <IconButton
          title="Back to Menu"
          icon="home"
          onPress={onBackToMenu}
          color={theme.neutralButton}
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { gap: 8, alignItems: 'center', width: '100%' },
    headline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    title: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
    stats: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  });
