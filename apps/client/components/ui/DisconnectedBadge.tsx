import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

/**
 * Small "disconnected" chip next to a player the server has stopped hearing
 * from. Presence is public room-level information, so it shows for every such
 * player (not only the one being waited on): any of them can be removed.
 * Callers decide whether to render it; the visibility rule is just "the server
 * listed this player as disconnected", so there is nothing to gate here.
 */
export const DisconnectedBadge: React.FC<{ name: string }> = ({ name }) => {
  const styles = createStyles(useTheme());
  return (
    // Same single-accessible-element treatment as GOOJBadge, including the web
    // role="img" workaround for react-native-web ignoring role-less aria-labels.
    <View
      accessible
      {...(Platform.OS === 'web'
        ? { role: 'img' as const }
        : { accessibilityRole: 'text' as const })}
      accessibilityLabel={`${name} is disconnected`}
      style={styles.badge}
    >
      <Text style={styles.text}>Disconnected</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // flexShrink 0: under large Dynamic Type the sibling name text wraps, never the chip.
    badge: {
      flexShrink: 0,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.danger,
    },
    text: { fontSize: 12, fontWeight: '700', color: theme.danger },
  });
