import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { GameState, TurnTimer } from '@trade-tycoon/game-logic';
import { useTheme } from '../../hooks/useTheme';
import { useNow } from '../../hooks/useNow';
import type { Theme } from '../../constants/theme';
import {
  getRemainingMs,
  getTimerAccessibilityLabel,
  getTimerLabel,
  isTimeLow,
} from '../turn-timer-display';

interface TurnTimerBadgeProps {
  /** `state.timer`; the badge draws nothing without a localized one (hotseat, timers off). */
  timer: TurnTimer | null | undefined;
  /** Name of the player whose clock is running. */
  playerName: string;
  /** Whether that player is the local user (online), so the label can say "You". */
  isMe: boolean;
}

/**
 * Countdown for the running turn or auction-bid clock. It shows for everyone,
 * not just the player on the clock, so the table can see whose time it is and
 * how long is left. The server decides when time is up; this only displays it,
 * and sits at 0:00 until the server's skip arrives.
 */
export const TurnTimerBadge: React.FC<TurnTimerBadgeProps> = ({ timer, playerName, isMe }) => {
  const styles = createStyles(useTheme());
  const now = useNow(!!timer);
  const remaining = getRemainingMs(timer, now);
  if (!timer || remaining === null) return null;

  const low = isTimeLow(remaining);
  return (
    <View
      accessible
      {...(Platform.OS === 'web'
        ? { role: 'timer' as const }
        : { accessibilityRole: 'timer' as const })}
      accessibilityLabel={getTimerAccessibilityLabel(timer, playerName, isMe, remaining)}
      style={[styles.badge, low && styles.badgeLow]}
    >
      <Text style={[styles.text, low && styles.textLow]}>
        ⏱ {getTimerLabel(timer, playerName, isMe, remaining)}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    badgeLow: { borderColor: theme.danger },
    text: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    textLow: { color: theme.danger },
  });

/**
 * `TurnTimerBadge` for whoever the game's running timer belongs to: the current
 * player's turn, or the current bidder during an auction.
 */
export const GameTimerBadge: React.FC<{ state: GameState; myPlayerId: string }> = ({
  state,
  myPlayerId,
}) => {
  const owner = state.players.find((p) => p.id === state.timer?.playerId);
  if (!state.timer || !owner) return null;
  return (
    <TurnTimerBadge timer={state.timer} playerName={owner.name} isMe={owner.id === myPlayerId} />
  );
};
