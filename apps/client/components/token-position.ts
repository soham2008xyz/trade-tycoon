/**
 * Pure board-geometry helpers for player tokens (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md). The `'worklet'` directives let
 * `PlayerToken` call them from a Reanimated `useAnimatedStyle`; they are plain
 * string literals everywhere else, including vitest.
 *
 * A tile's name and price sit in the middle of its content area, so a token
 * there hides them (#268). Tokens go to a free corner of the tile instead: on
 * the side away from the colour bar (where houses and hotels also draw) and at
 * one end of the tile. `Tile` puts that bar on the board-facing side of the left
 * and right columns but on the outer side of the top and bottom rows, so the
 * token sits at the outer edge on the columns and the inner edge on the rows.
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
  return Math.min(16, Math.max(10, Math.round(boardSize * 0.027)));
}

/** Distance along one edge (0 = first tile after the corner) → fraction of the board. */
const alongEdge = (tileOnEdge: number) => {
  'worklet';
  return CORNER_PCT + tileOnEdge * TILE_PCT + TILE_PCT / 2;
};

/**
 * Position of the token for a tile, in px from the board's top-left. `slot` is
 * the player's index: the first two players take the two ends of the tile, and
 * any more stack away from the edge they are anchored to, so none sits on
 * another's seat.
 */
export function getTokenPoint(
  tileIndex: number,
  boardSize: number,
  tokenSize: number,
  slot: number
): Point {
  'worklet';
  const i = tileIndex % 40;
  // Distance from an edge to the token's centre when it touches that edge.
  const near = tokenSize / 2 + EDGE_MARGIN;
  const far = boardSize - near;
  const stack = Math.floor(slot / 2) * tokenSize * 0.55;
  const isSecond = slot % 2 === 1;

  // Corners: tuck into the outer corner of the square; the second seat moves
  // inward so no token pokes out past the board.
  const lateral = isSecond ? tokenSize * 0.6 : 0;
  if (i === 0) return { x: far - lateral, y: far - stack };
  if (i === 10) return { x: near + lateral, y: far - stack };
  if (i === 20) return { x: near + lateral, y: near + stack };
  if (i === 30) return { x: far - lateral, y: near + stack };

  // Along the tile: seats at its two ends. `Tile` draws its owner dot in the
  // top-right corner, so the first seat is the end away from it; only a second
  // player on an owned tile can cover the dot. On the right column that corner
  // is the top end, so its first seat is the bottom one.
  const reach = (TILE_PCT * boardSize) / 2 - near;
  const firstEnd = i > 30 ? 1 : -1;
  const along = (isSecond ? -firstEnd : firstEnd) * reach;
  const corner = CORNER_PCT * boardSize;

  if (i < 10) {
    // Bottom row, right to left; colour bar at the bottom, token at the top.
    return {
      x: (1 - alongEdge(i - 1)) * boardSize + along,
      y: boardSize - corner + near + stack,
    };
  }
  if (i < 20) {
    // Left column, bottom to top; colour bar on the right, token at the left.
    return { x: near + stack, y: (1 - alongEdge(i - 11)) * boardSize + along };
  }
  if (i < 30) {
    // Top row, left to right; colour bar at the top, token at the bottom.
    return { x: alongEdge(i - 21) * boardSize + along, y: corner - near - stack };
  }
  // Right column, top to bottom; colour bar on the left, token at the right.
  return { x: far - stack, y: alongEdge(i - 31) * boardSize + along };
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
