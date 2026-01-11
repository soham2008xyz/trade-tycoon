import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  Easing
} from 'react-native-reanimated';

interface DiceProps {
  value1: number;
  value2: number;
  size?: number;
  color?: string;
}

// Map numbers to dice icon names
const getDiceIconName = (value: number): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (value) {
    case 1: return 'dice-1';
    case 2: return 'dice-2';
    case 3: return 'dice-3';
    case 4: return 'dice-4';
    case 5: return 'dice-5';
    case 6: return 'dice-6';
    default: return 'dice-multiple'; // Fallback
  }
};

const Die: React.FC<{ value: number; size: number; color: string; delay?: number }> = ({ value, size, color, delay = 0 }) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Reset
    rotation.value = 0;
    scale.value = 1;

    // Animate
    rotation.value = withSequence(
      withTiming(360, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withSequence(
      withTiming(1.2, { duration: 250 }),
      withSpring(1)
    );
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, { marginHorizontal: 4 }]}>
      <MaterialCommunityIcons name={getDiceIconName(value)} size={size} color={color} />
    </Animated.View>
  );
};

export const Dice: React.FC<DiceProps> = ({ value1, value2, size = 40, color = 'black' }) => {
  return (
    <View style={styles.container}>
      <Die value={value1} size={size} color={color} />
      <Die value={value2} size={size} color={color} delay={100} />
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
