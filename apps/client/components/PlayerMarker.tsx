import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getPlayerShape } from '@trade-tycoon/game-logic';
import { useTheme } from '../hooks/useTheme';

/** Outline for markers on the board, which stays light in dark mode. */
export const BOARD_OUTLINE = '#1f2937';

interface Props {
  /** The player's color; it also selects the shape (see `getPlayerShape`). */
  color: string;
  size: number;
  /**
   * Outline drawn behind the shape so a pale color (yellow, pink, cyan) or a
   * dark one still separates from its background. Defaults to the theme's text
   * color; pass a fixed one on the board, which stays light in dark mode.
   */
  outlineColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * A player's identity mark: a colored shape, unique per player, so players can
 * be told apart without relying on color alone. It is decorative — callers
 * always render the player's name or an accessibility label next to or on it.
 */
export const PlayerMarker: React.FC<Props> = ({ color, size, outlineColor, style, children }) => {
  const theme = useTheme();
  const shape = getPlayerShape(color);
  // A thinner ring at small sizes, or it would eat most of the colored fill.
  const ring = size < 14 ? 1 : 1.5;
  const inner = size - ring * 2;

  return (
    <View accessible={false} style={[styles.box, { width: size, height: size }, style]}>
      <MaterialCommunityIcons
        name={shape}
        size={size}
        color={outlineColor ?? theme.textPrimary}
        style={styles.layer}
        allowFontScaling={false}
      />
      <MaterialCommunityIcons
        name={shape}
        size={inner}
        color={color}
        style={styles.layer}
        allowFontScaling={false}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  layer: { position: 'absolute' },
});
