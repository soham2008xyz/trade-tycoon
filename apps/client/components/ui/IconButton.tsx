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
  color = '#2196F3',
  textColor = 'white',
  disabled,
  style,
  textStyle,
  size = 'medium',
  ...props
}) => {
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
      style={[styles.button, { backgroundColor: disabled ? '#ccc' : color }, getPadding(), style]}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      <View style={styles.content}>
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={getIconSize()}
            color={disabled ? '#888' : textColor}
            style={title ? styles.icon : undefined}
          />
        )}
        <Text
          style={[
            styles.text,
            { color: disabled ? '#666' : textColor, fontSize: getFontSize() },
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
