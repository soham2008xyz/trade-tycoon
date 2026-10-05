import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { IconButton } from './IconButton';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title: string;
  message: string;
  buttons?: AlertButton[];
}

interface CustomAlertProps {
  visible: boolean;
  options: AlertOptions | null;
  onClose: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({ visible, options, onClose }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!visible || !options) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{options.title}</Text>
          <Text style={styles.message}>{options.message}</Text>
          <View style={styles.buttonContainer}>
            {options.buttons?.map((btn, index) => (
              <IconButton
                key={index}
                title={btn.text}
                onPress={() => {
                  if (btn.onPress) {
                    btn.onPress();
                  }
                  onClose();
                }}
                color={
                  btn.style === 'destructive'
                    ? theme.danger
                    : btn.style === 'cancel'
                      ? theme.neutralButton
                      : theme.primary
                }
                style={styles.button}
                size="medium"
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    alertBox: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      maxWidth: 400,
      elevation: 5,
      boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 10,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 22,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    button: {
      minWidth: 100,
    },
  });
