import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface Props {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
  /** Icon-only, so this is all a screen reader gets; override to say what closes. */
  accessibilityLabel?: string;
}

export const CloseButton: React.FC<Props> = ({
  onPress,
  style,
  size = 30,
  accessibilityLabel = 'Close',
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <MaterialCommunityIcons name="close" size={size * 0.6} color={theme.onAccent} />
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.danger,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 3,
      boxShadow: '0px 1px 2px rgba(0,0,0,0.2)',
    },
  });
