import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getHeldCardsBadge } from '../held-cards';

// Same icon + colour as the "Use Card" button, so the badge reads as the same card.
const CARD_COLOR = '#5bc0de';

/**
 * Small "card ×N" chip for a player's held Get Out of Jail Free cards.
 * Renders nothing when they hold none. Shown for every player in both hotseat
 * and online (the count is public state), so there is no gating — see
 * `getHeldCardsBadge`.
 */
export const GOOJBadge: React.FC<{ count: number | undefined }> = ({ count }) => {
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
      <MaterialCommunityIcons name="card-account-details" size={14} color={CARD_COLOR} />
      <Text style={styles.text}>{badge.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderColor: CARD_COLOR,
  },
  text: { fontSize: 12, fontWeight: '700', color: '#2a7f9c' },
});
