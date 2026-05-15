import React from 'react';
import { Modal, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameLayout } from '../../hooks/useGameLayout';
import { CloseButton } from './CloseButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When false (default true), do not render the close button in the header. */
  showClose?: boolean;
  children: React.ReactNode;
}

/**
 * On phone: full-screen Modal with a safe-area header (close-X + title).
 * On tablet / wide-web: transparent centered Modal — children own their
 * own backdrop styling, matching the existing iPad overlay.
 */
export const FullScreenModalShell: React.FC<Props> = ({
  visible,
  onClose,
  title,
  showClose = true,
  children,
}) => {
  const layout = useGameLayout();

  if (layout === 'phone') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
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
    <Modal visible={visible} animationType="slide" transparent>
      {children}
    </Modal>
  );
};

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
