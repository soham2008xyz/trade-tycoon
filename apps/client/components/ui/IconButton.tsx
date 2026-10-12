import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface IconButtonProps extends TouchableOpacityProps {
  title: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'small' | 'medium' | 'large';
}

type IconButtonSize = NonNullable<IconButtonProps['size']>;

interface SizeMetrics {
  padding: { paddingVertical: number; paddingHorizontal: number };
  fontSize: number;
  iconSize: number;
}

const sizeMetrics = (size: IconButtonSize): SizeMetrics => {
  switch (size) {
    case 'small':
      return { padding: { paddingVertical: 6, paddingHorizontal: 12 }, fontSize: 12, iconSize: 16 };
    case 'large':
      return {
        padding: { paddingVertical: 12, paddingHorizontal: 24 },
        fontSize: 18,
        iconSize: 24,
      };
    default:
      return {
        padding: { paddingVertical: 10, paddingHorizontal: 20 },
        fontSize: 14,
        iconSize: 20,
      };
  }
};

interface IconButtonLabelProps {
  title: string;
  icon?: IconButtonProps['icon'];
  textStyle?: IconButtonProps['textStyle'];
  color: string;
  fontSize: number;
  iconSize: number;
}

const IconButtonLabel: React.FC<IconButtonLabelProps> = ({
  title,
  icon,
  textStyle,
  color,
  fontSize,
  iconSize,
}) => (
  <View style={styles.content}>
    {icon && (
      <MaterialCommunityIcons
        name={icon}
        size={iconSize}
        color={color}
        style={title ? styles.icon : undefined}
        // The title already names the button; the glyph would be read as a stray character.
        // With no title the glyph is the only cue, so the caller must label the button.
        aria-hidden={!!title}
      />
    )}
    <Text style={[styles.text, { color, fontSize }, textStyle]}>{title}</Text>
  </View>
);

export const IconButton: React.FC<IconButtonProps> = (props) => {
  const { title, icon, color, textColor, disabled, style, textStyle, size, ...rest } = props;
  const theme = useTheme();
  const { padding, fontSize, iconSize } = sizeMetrics(size ?? 'medium');
  const labelColor = disabled ? theme.disabledText : (textColor ?? theme.onAccent);

  return (
    <TouchableOpacity
      // First on purpose: after a {…} attribute a hyphenated one makes Lizard (the CI
      // complexity analysis) lose where the component ends and fold the styles into it.
      aria-disabled={!!disabled}
      style={[
        styles.button,
        // Disabled buttons are flat: on Android an elevation shadow shows through a
        // fill that a dimmed ancestor has made translucent, as a box behind the label (#316).
        !disabled && styles.raised,
        { backgroundColor: disabled ? theme.disabledFill : (color ?? theme.primary) },
        padding,
        style,
      ]}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title || undefined}
      {...rest}
    >
      <IconButtonLabel
        title={title}
        icon={icon}
        textStyle={textStyle}
        color={labelColor}
        fontSize={fontSize}
        iconSize={iconSize}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: {
    elevation: 2,
    boxShadow: '0px 2px 2px rgba(0,0,0,0.2)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
