import React from 'react';
import { Modal, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameLayout } from '../../hooks/useGameLayout';
import { CloseButton } from './CloseButton';

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
  const dismiss = showClose ? onClose : NOOP;

  if (layout === 'phone') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={showClose ? 'pageSheet' : 'fullScreen'}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={dismiss}
        onDismiss={dismiss}
      >
        <SafeAreaView style={styles.phoneRoot} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.phoneHeader}>
            {showClose ? <CloseButton onPress={onClose} /> : <View style={styles.headerSpacer} />}
            {title ? <Text style={styles.phoneTitle}>{title}</Text> : null}
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.phoneBody}>{children}</View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
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

const styles = StyleSheet.create({
  phoneRoot: { flex: 1, backgroundColor: '#fff' },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  phoneTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 32 },
  phoneBody: { flex: 1 },
});
