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

export const IconButton: React.FC<IconButtonProps> = ({
  title,
  icon,
  color: colorProp,
  textColor: textColorProp,
  disabled,
  style,
  textStyle,
  size = 'medium',
  ...props
}) => {
  const theme = useTheme();
  const color = colorProp ?? theme.primary;
  const textColor = textColorProp ?? theme.onAccent;

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 6, paddingHorizontal: 12 };
      case 'large':
        return { paddingVertical: 12, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 10, paddingHorizontal: 20 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 18;
      default:
        return 14;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        // Disabled buttons are flat: on Android an elevation shadow shows through a
        // fill that a dimmed ancestor has made translucent, as a box behind the label (#316).
        !disabled && styles.raised,
        { backgroundColor: disabled ? theme.disabledFill : color },
        getPadding(),
        style,
      ]}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title || undefined}
      aria-disabled={!!disabled}
      {...props}
    >
      <View style={styles.content}>
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={getIconSize()}
            color={disabled ? theme.disabledText : textColor}
            style={title ? styles.icon : undefined}
            // The title already names the button; the glyph would be read as a stray character.
            // With no title the glyph is the only cue, so the caller must label the button.
            aria-hidden={!!title}
          />
        )}
        <Text
          style={[
            styles.text,
            { color: disabled ? theme.disabledText : textColor, fontSize: getFontSize() },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
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
