import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Player } from '@trade-tycoon/game-logic';
import { getPlayerTokenLabel } from './jail-status';
import { getInterpolatedPoint, getTokenSize } from './token-position';

interface Props {
  player: Player;
  boardSize: number;
  index: number;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

const PlayerTokenComponent: React.FC<Props> = ({
  player,
  boardSize,
  index,
  onAnimationStart,
  onAnimationComplete,
}) => {
  const visualIndex = useSharedValue(player.position);

  useEffect(() => {
    const currentPos = Math.round(visualIndex.value) % 40;
    let diff = (player.position - currentPos + 40) % 40;

    if (diff === 0) return;

    if (diff <= 12) {
      if (onAnimationStart) onAnimationStart();

      const animations = [];
      const current = Math.round(visualIndex.value);

      for (let i = 1; i <= diff; i++) {
        const isLastStep = i === diff;

        // Move to next tile
        animations.push(
          withTiming(
            current + i,
            {
              duration: 300,
              easing: Easing.inOut(Easing.quad),
            },
            (finished) => {
              if (finished && isLastStep && onAnimationComplete) {
                runOnJS(onAnimationComplete)();
              }
            }
          )
        );

        // Pause on tile (if not the last one)
        if (i < diff) {
          animations.push(withTiming(current + i, { duration: 150 }));
        }
      }

      // Use spread operator to pass array elements as arguments
      // @ts-ignore - spread operator works for withSequence
      // Reanimated's SharedValue.value assignment is the documented API for
      // driving an animation, not a disallowed mutation of a hook's return value.
      visualIndex.value = withSequence(...animations);
    } else {
      visualIndex.value = player.position;
    }
  }, [player.position, onAnimationStart, onAnimationComplete, visualIndex]);

  const style = useAnimatedStyle(() => {
    const tokenSize = getTokenSize(boardSize);
    const point = getInterpolatedPoint(visualIndex.value, boardSize, tokenSize, index);

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: tokenSize,
      height: tokenSize,
      backgroundColor: player.color,
      borderRadius: tokenSize / 2,
      borderWidth: 2,
      borderColor: 'white',
      transform: [
        { translateX: point.x - tokenSize / 2 },
        { translateY: point.y - tokenSize / 2 },
      ],
      zIndex: 100 + index,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    };
  });

  return (
    <Animated.View
      accessible
      {...(Platform.OS === 'web'
        ? { role: 'img' as const }
        : { accessibilityRole: 'image' as const })}
      accessibilityLabel={getPlayerTokenLabel(player)}
      pointerEvents="none"
      style={style}
    >
      {player.isInJail && (
        <View style={styles.jailMarker}>
          <MaterialCommunityIcons name="lock" size={11} color="white" />
        </View>
      )}
    </Animated.View>
  );
};

export const PlayerToken = React.memo(PlayerTokenComponent);

const styles = StyleSheet.create({
  jailMarker: {
    position: 'absolute',
    // Above the token so a visitor sharing tile 10 cannot cover the lock.
    top: -13,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 3,
    backgroundColor: '#7c2d12',
    borderWidth: 1,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
