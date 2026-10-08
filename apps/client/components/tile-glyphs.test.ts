import { describe, it, expect } from 'vitest';
import { BOARD } from '@trade-tycoon/game-logic';
import type { Tile } from '@trade-tycoon/game-logic';
import { getCompactTileGlyph } from './tile-glyphs';

const tileOfType = (type: Tile['type']): Tile => {
  const tile = BOARD.find((t) => t.type === type);
  if (!tile) throw new Error(`no ${type} tile on the board`);
  return tile;
};

describe('getCompactTileGlyph', () => {
  it.each([
    ['chance', 'help'],
    ['community_chest', 'treasure-chest'],
    ['tax', 'percent'],
    ['railroad', 'train'],
  ] as const)('marks %s tiles with %s', (type, glyph) => {
    expect(getCompactTileGlyph(tileOfType(type))).toBe(glyph);
  });

  it('tells the two utilities apart', () => {
    const byId = (id: string) => BOARD.find((t) => t.id === id) as Tile;
    expect(getCompactTileGlyph(byId('electric'))).toBe('flash');
    expect(getCompactTileGlyph(byId('water'))).toBe('water');
  });

  it('leaves streets to their colour bar', () => {
    expect(getCompactTileGlyph(tileOfType('street'))).toBeNull();
  });

  it('gives every non-street edge tile a glyph', () => {
    const corners = new Set(['go', 'jail', 'parking', 'go_to_jail']);
    const unmarked = BOARD.filter(
      (t) => t.type !== 'street' && !corners.has(t.type) && getCompactTileGlyph(t) === null
    );
    expect(unmarked).toEqual([]);
  });
});
