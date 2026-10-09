import { PLAYER_COLORS } from './player-colors';

/**
 * Marker shapes, one per palette color (same index). Colour alone can't carry a
 * player's identity for colour-blind players, so every palette color is bound to
 * a shape that is distinct at small sizes and in grayscale. The names double as
 * the accessible shape name and as MaterialCommunityIcons glyph names on the
 * client.
 */
export const PLAYER_SHAPES = [
  'circle',
  'square',
  'triangle',
  'rhombus',
  'star',
  'hexagon',
  'pentagon',
  'octagon',
] as const;

export type PlayerShape = (typeof PLAYER_SHAPES)[number];

/**
 * The shape for a player's color. It is derived, not stored: a color is already
 * unique per game (`hasDuplicateColors` blocks starting otherwise), so shapes
 * are unique too, and they survive reconnects, joins and leaves with no extra
 * state to keep in sync. A color outside the palette (e.g. from a game saved
 * under an older palette) falls back to the circle.
 */
export const getPlayerShape = (color: string): PlayerShape => {
  const index = PLAYER_COLORS.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  // `find` rather than `PLAYER_SHAPES[index]`: security linters flag a
  // variable bracket lookup as an object-injection sink, and a miss (-1) falls
  // through to the circle without a separate check.
  return PLAYER_SHAPES.find((_, i) => i === index) ?? 'circle';
};
