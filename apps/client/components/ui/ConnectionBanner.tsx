import React, { useEffect } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

export const CONNECTION_LOST_MESSAGE = 'Connection lost. This screen may be out of date.';

/**
 * Non-blocking strip shown while the server is unreachable. It sits at the
 * bottom (the Toast owns the top), ignores touches so play stays possible, and
 * is only mounted while offline: it clears itself when the caller unmounts it.
 */
export const ConnectionBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  // A screen reader doesn't notice a view that appears on its own (see Toast).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(CONNECTION_LOST_MESSAGE);
  }, []);

  return (
    // `announceForAccessibility` is a no-op in react-native-web, so the alert
    // role is what makes web screen readers read the message.
    <View
      role="alert"
      pointerEvents="none"
      style={[styles.container, { bottom: insets.bottom + 8 }]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{CONNECTION_LOST_MESSAGE}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 20,
      right: 20,
      alignItems: 'center',
      zIndex: 999,
    },
    content: {
      backgroundColor: theme.toastBg,
      borderWidth: 1,
      borderColor: theme.warning,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    text: {
      color: theme.toastText,
      fontSize: 14,
      textAlign: 'center',
    },
  });
