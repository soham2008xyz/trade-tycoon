import React from 'react';
import { View, Text } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import { createOnlineStyles } from './online-styles';

interface Props {
  title: string;
  message: string;
  /** Shows a Back button when given. */
  onBack?: () => void;
}

/** A card with a title and a line of text, e.g. "Resuming…". */
export const OnlineMessage: React.FC<Props> = ({ title, message, onBack }) => {
  const styles = createOnlineStyles(useTheme());
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.waitingText}>{message}</Text>
        {onBack && (
          <IconButton
            title="Back"
            icon="arrow-left"
            onPress={onBack}
            style={styles.secondaryButton}
          />
        )}
      </View>
    </View>
  );
};
