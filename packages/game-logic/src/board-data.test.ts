import { describe, it, expect } from 'vitest';
import { BOARD, isTileBuyable } from './board-data';

describe('board-data', () => {
  it('defines a complete 40-tile board with unique ids and indices', () => {
    expect(BOARD).toHaveLength(40);

    const ids = BOARD.map((tile) => tile.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(40);

    const indices = BOARD.map((tile) => tile.index);
    expect(indices).toEqual([...Array(40).keys()]);
  });

  it('keeps key fixed board positions intact', () => {
    expect(BOARD[0].id).toBe('go');
    expect(BOARD[10].id).toBe('jail');
    expect(BOARD[20].id).toBe('parking');
    expect(BOARD[30].id).toBe('go_to_jail');
  });

  it('isTileBuyable returns false for non-buyable tile types', () => {
    const nonBuyableIds = ['go', 'tax1', 'jail', 'parking', 'chance1', 'chest1', 'go_to_jail'];

    for (const tileId of nonBuyableIds) {
      const tile = BOARD.find((entry) => entry.id === tileId);
      expect(tile).toBeDefined();
      expect(isTileBuyable(tile!)).toBe(false);
    }
  });

  it('isTileBuyable returns true for street, railroad, and utility tiles', () => {
    const buyableIds = ['mediterranean', 'reading_rr', 'electric'];

    for (const tileId of buyableIds) {
      const tile = BOARD.find((entry) => entry.id === tileId);
      expect(tile).toBeDefined();
      expect(isTileBuyable(tile!)).toBe(true);
    }
  });
});
