import { describe, expect, it } from 'vitest';
import { getInterpolatedPoint, getTokenPoint, getTokenSize } from './token-position';

const CORNER = 0.14;
const TILE = (1 - 2 * CORNER) / 9;

/** Tile rectangle in px (x, y = top-left), mirroring Board's layout. */
function tileRect(index: number, board: number) {
  const c = CORNER * board;
  const t = TILE * board;
  if (index === 0) return { x: board - c, y: board - c, w: c, h: c };
  if (index === 10) return { x: 0, y: board - c, w: c, h: c };
  if (index === 20) return { x: 0, y: 0, w: c, h: c };
  if (index === 30) return { x: board - c, y: 0, w: c, h: c };
  if (index < 10) return { x: board - c - index * t, y: board - c, w: t, h: c };
  if (index < 20) return { x: 0, y: board - c - (index - 10) * t, w: c, h: t };
  if (index < 30) return { x: c + (index - 21) * t, y: 0, w: t, h: c };
  return { x: board - c, y: c + (index - 31) * t, w: c, h: t };
}

/**
 * Where tokens anchor: the edge away from the colour bar. The bar faces the
 * board centre on every edge, so the anchor is always the outer edge. Returns
 * the token's centre as a fraction of the tile depth from that edge.
 */
function anchorFraction(index: number, p: { x: number; y: number }, board: number) {
  const r = tileRect(index, board);
  if (index < 10) return (r.y + r.h - p.y) / r.h; // bottom row: outer edge is the bottom
  if (index < 20) return (p.x - r.x) / r.w; // left column: outer edge is the left
  if (index < 30) return (p.y - r.y) / r.h; // top row: outer edge is the top
  return (r.x + r.w - p.x) / r.w; // right column: outer edge is the right
}

const BOARDS = [360, 370, 770, 1000];

describe('getTokenSize', () => {
  it('shrinks on small boards and caps on large ones', () => {
    expect(getTokenSize(300)).toBe(10);
    expect(getTokenSize(800)).toBe(16);
    expect(getTokenSize(2000)).toBe(16);
  });
});

describe('getTokenPoint', () => {
  it.each(BOARDS)(
    'keeps the whole token inside its tile for all 8 seats at board size %i',
    (board) => {
      const size = getTokenSize(board);
      for (let tile = 0; tile < 40; tile++) {
        const r = tileRect(tile, board);
        for (let slot = 0; slot < 8; slot++) {
          const p = getTokenPoint(tile, board, size, slot);
          expect(p.x - size / 2).toBeGreaterThanOrEqual(r.x);
          expect(p.x + size / 2).toBeLessThanOrEqual(r.x + r.w);
          expect(p.y - size / 2).toBeGreaterThanOrEqual(r.y);
          expect(p.y + size / 2).toBeLessThanOrEqual(r.y + r.h);
        }
      }
    }
  );

  it.each(BOARDS)(
    'puts a lone token in the half of edge tiles that is away from the colour bar at board size %i',
    (board) => {
      const size = getTokenSize(board);
      for (let tile = 1; tile < 40; tile++) {
        if (tile % 10 === 0) continue;
        const p = getTokenPoint(tile, board, size, 0);
        expect(anchorFraction(tile, p, board)).toBeLessThan(0.5);
      }
    }
  );

  it.each(BOARDS)('keeps a lone token off the middle of the tile at board size %i', (board) => {
    const size = getTokenSize(board);
    for (let tile = 1; tile < 40; tile++) {
      if (tile % 10 === 0) continue;
      const r = tileRect(tile, board);
      const p = getTokenPoint(tile, board, size, 0);
      // Name and price sit in the middle, so the token must sit at an end of the
      // tile along its length: its centre is at least a quarter of the tile
      // from the middle.
      const rowTile = tile < 10 || (tile > 20 && tile < 30);
      const offset = rowTile ? Math.abs(p.x - (r.x + r.w / 2)) : Math.abs(p.y - (r.y + r.h / 2));
      const length = rowTile ? r.w : r.h;
      expect(offset).toBeGreaterThanOrEqual(length * 0.25);
    }
  });

  it.each(BOARDS)('keeps a lone token off the colour bar at board size %i', (board) => {
    const size = getTokenSize(board);
    for (let tile = 1; tile < 40; tile++) {
      if (tile % 10 === 0) continue;
      const r = tileRect(tile, board);
      const p = getTokenPoint(tile, board, size, 0);
      const depth = tile < 10 || (tile > 20 && tile < 30) ? r.h : r.w;
      // The bar takes the 25% of the depth opposite the anchor edge.
      const tokenFarEdge = anchorFraction(tile, p, board) * depth + size / 2;
      expect(tokenFarEdge).toBeLessThanOrEqual(depth * 0.75);
    }
  });

  it.each(BOARDS)('keeps a lone token off the owner dot at board size %i', (board) => {
    const size = getTokenSize(board);
    for (let tile = 1; tile < 40; tile++) {
      if (tile % 10 === 0) continue;
      const r = tileRect(tile, board);
      const p = getTokenPoint(tile, board, size, 0);
      // Tile draws the owner dot 2px in from the top-right corner of its content
      // area, 8px across. On the bottom row the bar sits above the content, so
      // the dot starts below the bar's 25% of the tile depth.
      const top = r.y + (tile < 10 ? r.h * 0.25 : 0) + 2;
      const dot = { l: r.x + r.w - 10, r: r.x + r.w - 2, t: top, b: top + 8 };
      const apart =
        p.x + size / 2 <= dot.l ||
        p.x - size / 2 >= dot.r ||
        p.y + size / 2 <= dot.t ||
        p.y - size / 2 >= dot.b;
      expect(apart).toBe(true);
    }
  });

  it('puts corner tokens in the outer corner', () => {
    const board = 770;
    const size = getTokenSize(board);
    const go = getTokenPoint(0, board, size, 0);
    expect(go.x).toBeGreaterThan(board * 0.86);
    expect(go.y).toBeGreaterThan(board * 0.86);
    const parking = getTokenPoint(20, board, size, 0);
    expect(parking.x).toBeLessThan(board * 0.14);
    expect(parking.y).toBeLessThan(board * 0.14);
  });

  it('gives players on the same tile different seats', () => {
    const board = 770;
    const size = getTokenSize(board);
    for (const tile of [0, 5, 10, 15, 20, 25, 30, 35]) {
      const seats = [0, 1, 2, 3].map((slot) => getTokenPoint(tile, board, size, slot));
      const keys = new Set(seats.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`));
      expect(keys.size).toBe(4);
    }
  });

  it('wraps indices past the last tile', () => {
    expect(getTokenPoint(40, 770, 22, 0)).toEqual(getTokenPoint(0, 770, 22, 0));
  });
});

describe('getInterpolatedPoint', () => {
  it('returns the tile point at whole indices', () => {
    expect(getInterpolatedPoint(7, 770, 22, 1)).toEqual(getTokenPoint(7, 770, 22, 1));
  });

  it('lies halfway between neighbours at a half index', () => {
    const a = getTokenPoint(3, 770, 22, 0);
    const b = getTokenPoint(4, 770, 22, 0);
    const mid = getInterpolatedPoint(3.5, 770, 22, 0);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
  });

  it('wraps from tile 39 back to GO', () => {
    const a = getTokenPoint(39, 770, 22, 0);
    const b = getTokenPoint(0, 770, 22, 0);
    const mid = getInterpolatedPoint(39.5, 770, 22, 0);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
  });

  it('normalises negative indices', () => {
    expect(getInterpolatedPoint(-1, 770, 22, 0)).toEqual(getTokenPoint(39, 770, 22, 0));
  });
});
