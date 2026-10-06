import React, { createContext, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

export const CONNECTION_LOST_MESSAGE = 'Connection lost. This screen may be out of date.';

// Context, not a prop: a `Modal` mounts in a separate native root, so a banner
// rendered beside the game screen sits under any open modal (an auction cannot
// be dismissed). React context still crosses that boundary, so each modal
// shell can render its own banner. Offline play never mounts a provider and
// reads "connected".
const ConnectionStatusContext = createContext(true);

/**
 * Supplies the connection state to every `ConnectionBanner` below it and
 * announces a loss once, however many banners (screen plus open modals) show.
 */
export const ConnectionStatusProvider: React.FC<{
  connected: boolean;
  children: React.ReactNode;
}> = ({ connected, children }) => {
  // A screen reader doesn't notice a view that appears on its own (see Toast).
  useEffect(() => {
    if (!connected) AccessibilityInfo.announceForAccessibility(CONNECTION_LOST_MESSAGE);
  }, [connected]);

  return (
    <ConnectionStatusContext.Provider value={connected}>
      {children}
    </ConnectionStatusContext.Provider>
  );
};

interface Props {
  /**
   * Overlay the top edge instead of taking space in the layout. For screens
   * with no layout to push down (the lobby card, a transparent modal).
   */
  floating?: boolean;
}

/**
 * Non-blocking strip shown while the server is unreachable. In game layouts it
 * sits in flow at the top, above the board, so it never covers the status
 * sheet; it renders nothing while connected.
 */
export const ConnectionBanner: React.FC<Props> = ({ floating = false }) => {
  const connected = useContext(ConnectionStatusContext);
  // The context, not `useSafeAreaInsets`: a transparent tablet modal has no
  // provider above it, and the hook throws there.
  const insets = useContext(SafeAreaInsetsContext);
  const styles = createStyles(useTheme());
  if (connected) return null;

  return (
    // `announceForAccessibility` is a no-op in react-native-web, so the alert
    // role is what makes web screen readers read the message.
    <View
      role="alert"
      pointerEvents="none"
      style={[styles.strip, floating && [styles.floating, { top: insets?.top ?? 0 }]]}
    >
      <Text style={styles.text}>{CONNECTION_LOST_MESSAGE}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    strip: {
      backgroundColor: theme.toastBg,
      borderBottomWidth: 2,
      borderBottomColor: theme.warning,
      paddingVertical: 6,
      paddingHorizontal: 16,
    },
    floating: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 999,
    },
    text: {
      color: theme.toastText,
      fontSize: 14,
      textAlign: 'center',
    },
  });
