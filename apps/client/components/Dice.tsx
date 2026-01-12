import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

interface DiceProps {
  value1: number;
  value2: number;
  size?: number;
  color?: string;
  isRolling?: boolean;
}

// Map numbers to dice icon names
const getDiceIconName = (value: number): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (value) {
    case 1:
      return 'dice-1';
    case 2:
      return 'dice-2';
    case 3:
      return 'dice-3';
    case 4:
      return 'dice-4';
    case 5:
      return 'dice-5';
    case 6:
      return 'dice-6';
    default:
      return 'dice-multiple'; // Fallback
  }
};

const Die: React.FC<{ value: number; size: number; color: string; isRolling?: boolean }> = ({
  value,
  size,
  color,
  isRolling,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isRolling) {
      // Continuous spinning
      rotation.value = withRepeat(
        withTiming(360, { duration: 500, easing: Easing.linear }),
        -1, // Infinite
        false // Do not reverse
      );
      scale.value = withSequence(withTiming(1.2, { duration: 250 }), withSpring(1));
    } else {
      // Stop spinning and land on value
      cancelAnimation(rotation);
      rotation.value = 0; // Reset or snap to 0
      // Optional: Add a small "landing" animation
      scale.value = withSequence(withTiming(1.2, { duration: 150 }), withSpring(1));
    }
  }, [isRolling, value, rotation, scale]); // React to isRolling change or value change

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    };
  });

  return (
    <Animated.View style={[animatedStyle, { marginHorizontal: 4 }]}>
      <MaterialCommunityIcons
        name={isRolling ? 'dice-multiple' : getDiceIconName(value)}
        size={size}
        color={color}
      />
    </Animated.View>
  );
};

export const Dice: React.FC<DiceProps> = ({
  value1,
  value2,
  size = 40,
  color = 'black',
  isRolling = false,
}) => {
  return (
    <View style={styles.container}>
      <Die value={value1} size={size} color={color} isRolling={isRolling} />
      <Die value={value2} size={size} color={color} isRolling={isRolling} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
});
