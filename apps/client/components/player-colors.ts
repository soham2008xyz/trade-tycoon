/** Token colors offered on the local Game Setup screen. */
export const PLAYER_COLORS = [
  '#FF0000',
  '#0000FF',
  '#008000',
  '#FFFF00',
  '#FFA500',
  '#800080',
  '#00FFFF',
  '#FFC0CB',
];

const normalize = (color: string) => color.toLowerCase();

/**
 * True when a player other than `playerIndex` already holds `color`. The
 * player's own current color is never "taken" so their selected swatch stays
 * tappable.
 */
export const isColorTakenByOthers = (
  players: { color: string }[],
  playerIndex: number,
  color: string
): boolean => players.some((p, i) => i !== playerIndex && normalize(p.color) === normalize(color));

/**
 * The first palette color nobody holds yet, so newly added players never
 * collide with existing ones. Falls back to the first palette color only when
 * the palette is exhausted (more players than colors) — callers should rely on
 * `hasDuplicateColors` to block starting in that case rather than assume the
 * palette is always large enough.
 */
export const pickUnusedColor = (players: { color: string }[]): string =>
  PLAYER_COLORS.find((c) => !players.some((p) => normalize(p.color) === normalize(c))) ??
  PLAYER_COLORS[0];

/** True when any two players share a color (case-insensitive). */
export const hasDuplicateColors = (players: { color: string }[]): boolean =>
  new Set(players.map((p) => normalize(p.color))).size !== players.length;
