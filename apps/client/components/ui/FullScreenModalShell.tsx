import React from 'react';
import { Modal, StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useGameLayout } from '../../hooks/useGameLayout';
import { CloseButton } from './CloseButton';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * When false, the modal cannot be dismissed by the user — no header X,
   * no iOS pageSheet swipe-down (we switch presentation to fullScreen),
   * and the Android back button is swallowed. Use this for modals whose
   * visibility is owned by reducer state that only resolves via in-modal
   * actions (e.g. AuctionModal, controlled by `state.phase === 'auction'`).
   * Defaults to true.
   */
  showClose?: boolean;
  children: React.ReactNode;
}

/**
 * On phone: full-screen Modal with a safe-area header (close-X + title).
 * On tablet / wide-web: transparent centered Modal — children own their
 * own backdrop styling, matching the existing iPad overlay.
 *
 * Modal dismissal is wired through `onClose` on both platforms: Android's
 * hardware back fires `onRequestClose`, iOS pageSheet swipe-down fires
 * `onDismiss`. Both are routed to `onClose` when `showClose` is true, and
 * to no-ops when it's false (paired with `presentationStyle="fullScreen"`
 * on phone to physically block the swipe-down gesture).
 */
export const FullScreenModalShell: React.FC<Props> = ({
  visible,
  onClose,
  title,
  showClose = true,
  children,
}) => {
  const layout = useGameLayout();
  const styles = createStyles(useTheme());
  const dismiss = showClose ? onClose : NOOP;

  if (layout === 'phone') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={showClose ? 'pageSheet' : 'fullScreen'}
        supportedOrientations={[
          'portrait',
          'portrait-upside-down',
          'landscape',
          'landscape-left',
          'landscape-right',
        ]}
        onRequestClose={dismiss}
        onDismiss={dismiss}
      >
        {/* A Modal mounts its content in a separate native root, so the app's
            SafeAreaProvider is not an ancestor. Without our own, SafeAreaView
            finds no provider and applies 0 insets — invisible in a pageSheet
            (it starts below the status bar) but it puts the header of a
            fullScreen modal under the Dynamic Island (#260). */}
        <SafeAreaProvider>
          <SafeAreaView style={styles.phoneRoot} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.phoneHeader}>
              {showClose ? <CloseButton onPress={onClose} /> : <View style={styles.headerSpacer} />}
              {title ? <Text style={styles.phoneTitle}>{title}</Text> : null}
              <View style={styles.headerSpacer} />
            </View>
            <View style={styles.phoneBody}>{children}</View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
      onRequestClose={dismiss}
      onDismiss={dismiss}
    >
      {children}
    </Modal>
  );
};

/**
 * Used as the dismiss handler when `showClose` is false — the modal is
 * fully controlled by reducer state and cannot be closed by the user.
 * We still need to provide *something* to onRequestClose so Android's
 * back button doesn't surface an unhandled-event warning.
 */
function NOOP(): void {
  /* intentional no-op for non-dismissable modals */
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    phoneRoot: { flex: 1, backgroundColor: theme.surface },
    phoneHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    phoneTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    headerSpacer: { width: 32 },
    phoneBody: { flex: 1 },
  });
