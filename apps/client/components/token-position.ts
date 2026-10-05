/**
 * Pure board-geometry helpers for player tokens (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md). The `'worklet'` directives let
 * `PlayerToken` call them from a Reanimated `useAnimatedStyle`; they are plain
 * string literals everywhere else, including vitest.
 *
 * Tokens sit at the outer edge of a tile, not its centre: the centre holds the
 * name and price, which a token would hide (#268). The inner edge is no better
 * because houses and hotels draw on the colour bar there.
 */

const CORNER_PCT = 0.14;
const EDGE_TILES = 9;
const TILE_PCT = (1 - 2 * CORNER_PCT) / EDGE_TILES;
const EDGE_MARGIN = 1;

export interface Point {
  x: number;
  y: number;
}

/** Token diameter in px: scales with the board so phone tiles keep room for text. */
export function getTokenSize(boardSize: number): number {
  'worklet';
  return Math.min(22, Math.max(13, Math.round(boardSize * 0.035)));
}

/** Distance along one edge (0 = first tile after the corner) → fraction of the board. */
const alongEdge = (tileOnEdge: number) => CORNER_PCT + tileOnEdge * TILE_PCT + TILE_PCT / 2;

/**
 * Position of the token for a tile, in px from the board's top-left. `slot` is
 * the player's index: players sharing a tile spread side by side along the
 * edge, then stack inward, so none sits on another's seat.
 */
export function getTokenPoint(
  tileIndex: number,
  boardSize: number,
  tokenSize: number,
  slot: number
): Point {
  'worklet';
  const i = tileIndex % 40;
  // Centre of the token when pressed against the outer edge.
  const outer = tokenSize / 2 + EDGE_MARGIN;
  const far = boardSize - outer;
  const side = (slot % 2) * 2 - 1; // -1 or +1
  const row = Math.floor(slot / 2);
  const spread = side * tokenSize * 0.3;
  const inward = row * tokenSize * 0.55;

  // Corners: tuck into the outer corner of the square.
  if (i === 0) return { x: far - spread, y: far - inward };
  if (i === 10) return { x: outer + spread, y: far - inward };
  if (i === 20) return { x: outer + spread, y: outer + inward };
  if (i === 30) return { x: far - spread, y: outer + inward };

  if (i < 10) {
    // Bottom row, right to left.
    return { x: (1 - alongEdge(i - 1)) * boardSize + spread, y: far - inward };
  }
  if (i < 20) {
    // Left column, bottom to top.
    return { x: outer + inward, y: (1 - alongEdge(i - 11)) * boardSize + spread };
  }
  if (i < 30) {
    // Top row, left to right.
    return { x: alongEdge(i - 21) * boardSize + spread, y: outer + inward };
  }
  // Right column, top to bottom.
  return { x: far - inward, y: alongEdge(i - 31) * boardSize + spread };
}

/** Point for a fractional tile index mid-move: a straight line between neighbours. */
export function getInterpolatedPoint(
  value: number,
  boardSize: number,
  tokenSize: number,
  slot: number
): Point {
  'worklet';
  let index = value % 40;
  if (index < 0) index += 40;

  const floorI = Math.floor(index);
  const ceilI = Math.ceil(index);
  const p1 = getTokenPoint(floorI, boardSize, tokenSize, slot);
  if (floorI === ceilI) return p1;

  // ceilI === 40 wraps to tile 0, which getTokenPoint handles via `% 40`.
  const p2 = getTokenPoint(ceilI, boardSize, tokenSize, slot);
  const t = index - floorI;
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}
