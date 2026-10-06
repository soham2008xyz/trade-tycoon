import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

// Breathing room between the status bar / Dynamic Island and the toast pill.
const TOP_MARGIN = 8;

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 3000 }) => {
  // Offset by the real top inset instead of a hard-coded guess: devices differ
  // (Dynamic Island ~59pt, notch ~47pt, Android varies) and web is 0, so a fixed
  // value either overlaps the island or leaves a dead gap. Applied inline so the
  // StyleSheet below stays static.
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [fadeAnim] = React.useState(() => new Animated.Value(0));

  // Callers typically pass an inline `() => ...` closure, which gets a new
  // identity every render even when `message` hasn't changed. Routing the
  // call through a ref (kept fresh, but not itself a dependency) keeps
  // `handleDismiss` — and therefore the auto-dismiss effect below — stable
  // across those re-renders, so a stream of unrelated re-renders (e.g. an
  // online game's SSE updates) can't keep restarting the countdown and
  // leave the toast stuck on screen indefinitely.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismissRef.current();
    });
  }, [fadeAnim]);

  useEffect(() => {
    // The toast is the only place rejections ("can't afford it", online 409s)
    // surface, and a screen reader doesn't notice a view that appears on its own.
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, handleDismiss, fadeAnim]);

  return (
    // `announceForAccessibility` is a no-op in react-native-web, so the alert
    // role is what makes web screen readers read the message.
    <Animated.View
      role="alert"
      style={[styles.container, { top: insets.top + TOP_MARGIN, opacity: fadeAnim }]}
    >
      <TouchableOpacity
        onPress={handleDismiss}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityHint="Dismisses this message"
      >
        <View style={styles.content}>
          <Text style={styles.text}>{message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 20,
      right: 20,
      alignItems: 'center',
      zIndex: 1000,
    },
    content: {
      backgroundColor: theme.toastBg,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
      elevation: 5,
    },
    text: {
      color: theme.toastText,
      fontSize: 16,
      textAlign: 'center',
    },
  });
