import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getHeldCardsBadge } from '../held-cards';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

/**
 * Small "card ×N" chip for a player's held Get Out of Jail Free cards.
 * Renders nothing when they hold none. Shown for every player in both hotseat
 * and online (the count is public state), so there is no gating — see
 * `getHeldCardsBadge`.
 */
export const GOOJBadge: React.FC<{ count: number | undefined }> = ({ count }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const badge = getHeldCardsBadge(count);
  if (!badge) return null;
  return (
    // One accessible element for the whole chip, so VoiceOver reads the label
    // instead of the bare icon glyph and "×2" separately. react-native-web renders
    // accessibilityRole="text" with no ARIA role, and a role-less div's aria-label
    // can be ignored, so the web build uses role="img" instead.
    <View
      accessible
      {...(Platform.OS === 'web'
        ? { role: 'img' as const }
        : { accessibilityRole: 'text' as const })}
      accessibilityLabel={badge.accessibilityLabel}
      style={styles.badge}
    >
      <MaterialCommunityIcons name="card-account-details" size={14} color={theme.info} />
      <Text style={styles.text}>{badge.text}</Text>
    </View>
  );
};

// `theme.info` is the "Use Card" button colour, so the badge reads as the same card.
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // flexShrink 0: under large Dynamic Type the sibling name text wraps, never the chip.
    badge: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.info,
    },
    text: { fontSize: 12, fontWeight: '700', color: theme.goojText },
  });
