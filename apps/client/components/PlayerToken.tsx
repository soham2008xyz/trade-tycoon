import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Player } from '@trade-tycoon/game-logic';

interface Props {
  player: Player;
  boardSize: number;
  index: number;
}

const CORNER_PCT = 0.14;
const EDGE_TILES = 9;
const TILE_PCT = (1 - 2 * CORNER_PCT) / EDGE_TILES;

const getTileCenter = (index: number) => {
  'worklet';
  const i = index % 40;

  // Corners
  if (i === 0) return { x: 1 - CORNER_PCT/2, y: 1 - CORNER_PCT/2 };
  if (i === 10) return { x: CORNER_PCT/2, y: 1 - CORNER_PCT/2 };
  if (i === 20) return { x: CORNER_PCT/2, y: CORNER_PCT/2 };
  if (i === 30) return { x: 1 - CORNER_PCT/2, y: CORNER_PCT/2 };

  // Edges
  if (i > 0 && i < 10) {
     // Bottom: Right to Left
     // i=1 is right-most street.
     const distFromRight = CORNER_PCT + (i - 1) * TILE_PCT + TILE_PCT / 2;
     return { x: 1 - distFromRight, y: 1 - CORNER_PCT/2 };
  }
  if (i > 10 && i < 20) {
     // Left: Bottom to Top
     const distFromBottom = CORNER_PCT + (i - 11) * TILE_PCT + TILE_PCT / 2;
     return { x: CORNER_PCT/2, y: 1 - distFromBottom };
  }
  if (i > 20 && i < 30) {
     // Top: Left to Right
     const distFromLeft = CORNER_PCT + (i - 21) * TILE_PCT + TILE_PCT / 2;
     return { x: distFromLeft, y: CORNER_PCT/2 };
  }
  if (i > 30 && i < 40) {
     // Right: Top to Bottom
     const distFromTop = CORNER_PCT + (i - 31) * TILE_PCT + TILE_PCT / 2;
     return { x: 1 - CORNER_PCT/2, y: distFromTop };
  }
  return { x: 0.5, y: 0.5 };
};

const getInterpolatedCoords = (val: number) => {
  'worklet';
  let index = val % 40;
  if (index < 0) index += 40;

  const floorI = Math.floor(index);
  const ceilI = Math.ceil(index);

  const p1 = getTileCenter(floorI);
  // Handle wrap from 39 -> 40 (which is 0)
  const p2 = getTileCenter(ceilI === 40 ? 0 : ceilI);

  if (floorI === ceilI) return p1;

  const t = index - floorI;
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
};

export const PlayerToken: React.FC<Props> = ({ player, boardSize, index }) => {
  const visualIndex = useSharedValue(player.position);

  useEffect(() => {
    const currentPos = Math.round(visualIndex.value) % 40;
    let diff = (player.position - currentPos + 40) % 40;

    if (diff === 0) return;

    if (diff <= 12) {
      visualIndex.value = withTiming(visualIndex.value + diff, {
        duration: 1000,
        easing: Easing.out(Easing.quad),
      });
    } else {
      visualIndex.value = player.position;
    }
  }, [player.position]);

  const style = useAnimatedStyle(() => {
    const coords = getInterpolatedCoords(visualIndex.value);
    const tokenSize = 20;

    // Offset logic to avoid stacking
    const offsetX = ((index % 2) * 2 - 1) * 4; // -4 or +4
    const offsetY = (Math.floor(index / 2) * 2 - 1) * 4; // -4 or +4

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
        { translateX: coords.x * boardSize - tokenSize / 2 + offsetX },
        { translateY: coords.y * boardSize - tokenSize / 2 + offsetY },
      ],
      zIndex: 100 + index,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    };
  });

  return <Animated.View style={style} />;
};
