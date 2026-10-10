import { describe, it, expect } from 'vitest';
import type { Tile } from '@trade-tycoon/game-logic';
import { getTileAccessibilityLabel } from './tile-labels';

const street: Tile = {
  id: 'boardwalk',
  index: 39,
  name: 'Boardwalk',
  type: 'street',
  group: 'dark_blue',
  price: 400,
};

describe('getTileAccessibilityLabel', () => {
  it('names an unowned tile with its price', () => {
    expect(getTileAccessibilityLabel({ tile: street })).toBe('Boardwalk, $400, unowned');
  });

  it('reads the amount on a tax tile but never calls it unowned', () => {
    const tax: Tile = { id: 'income_tax', index: 4, name: 'Income Tax', type: 'tax', price: 200 };
    expect(getTileAccessibilityLabel({ tile: tax })).toBe('Income Tax, $200');
  });

  it('omits the price and owner for a tile that cannot be bought', () => {
    const go: Tile = { id: 'go', index: 0, name: 'Go', type: 'go' };
    expect(getTileAccessibilityLabel({ tile: go })).toBe('Go');
  });

  it('names the owner', () => {
    expect(getTileAccessibilityLabel({ tile: street, ownerName: 'Alice' })).toBe(
      'Boardwalk, $400, owned by Alice'
    );
  });

  it('counts houses, singular and plural', () => {
    expect(getTileAccessibilityLabel({ tile: street, ownerName: 'Alice', houseCount: 1 })).toBe(
      'Boardwalk, $400, owned by Alice, 1 house'
    );
    expect(getTileAccessibilityLabel({ tile: street, ownerName: 'Alice', houseCount: 3 })).toBe(
      'Boardwalk, $400, owned by Alice, 3 houses'
    );
  });

  it('says hotel for five', () => {
    expect(getTileAccessibilityLabel({ tile: street, ownerName: 'Alice', houseCount: 5 })).toBe(
      'Boardwalk, $400, owned by Alice, hotel'
    );
  });

  it('says mortgaged last', () => {
    expect(
      getTileAccessibilityLabel({
        tile: street,
        ownerName: 'Alice',
        houseCount: 0,
        isMortgaged: true,
      })
    ).toBe('Boardwalk, $400, owned by Alice, mortgaged');
  });
});
