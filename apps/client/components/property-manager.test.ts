import { describe, expect, it } from 'vitest';
import { getMortgageButton, groupOwnedProperties } from './property-manager';

describe('groupOwnedProperties', () => {
  it('is empty without properties', () => {
    expect(groupOwnedProperties([])).toEqual([]);
  });

  it('groups tiles by color and keeps the order they were given in', () => {
    const groups = groupOwnedProperties(['vermont', 'oriental']);
    expect(groups.map(([group, tiles]) => [group, tiles.map((t) => t.id)])).toEqual([
      ['light_blue', ['vermont', 'oriental']],
    ]);
  });

  it('sorts groups by the first tile on the board, whatever the ownership order', () => {
    const groups = groupOwnedProperties(['st_charles', 'reading_rr', 'baltic', 'oriental']);
    expect(groups.map(([group]) => group)).toEqual(['brown', 'railroad', 'light_blue', 'pink']);
  });

  it('sorts a group by its first tile as given, not its lowest index', () => {
    // Pins the original behaviour: the sort key is `tiles[0]`.
    const groups = groupOwnedProperties(['vermont', 'reading_rr', 'oriental']);
    expect(groups.map(([group]) => group)).toEqual(['railroad', 'light_blue']);
  });

  it('lists utilities and railroads', () => {
    const groups = groupOwnedProperties(['electric', 'reading_rr']);
    expect(groups.map(([group]) => group)).toEqual(['railroad', 'utility']);
  });

  it('skips ids that are not on the board and tiles that are not properties', () => {
    expect(groupOwnedProperties(['nowhere', 'go', 'chance1', 'tax1'])).toEqual([]);
  });
});

describe('getMortgageButton', () => {
  const base = {
    mortgageValue: 100,
    isMortgaged: false,
    houses: 0,
    groupHasHouses: false,
    money: 0,
  };

  it('offers to mortgage an unmortgaged tile for its mortgage value', () => {
    expect(getMortgageButton(base)).toEqual({
      action: 'mortgage',
      label: 'Mortgage ($100)',
      disabled: false,
    });
  });

  it('does not need cash to mortgage', () => {
    expect(getMortgageButton({ ...base, money: 0 }).disabled).toBe(false);
  });

  it('blocks mortgaging while the tile has houses', () => {
    expect(getMortgageButton({ ...base, houses: 1 }).disabled).toBe(true);
  });

  it('blocks mortgaging while another tile in the group has houses', () => {
    expect(getMortgageButton({ ...base, groupHasHouses: true }).disabled).toBe(true);
  });

  it('offers to unmortgage a mortgaged tile for the value plus interest', () => {
    expect(getMortgageButton({ ...base, isMortgaged: true, money: 110 })).toEqual({
      action: 'unmortgage',
      label: 'Unmortgage ($110)',
      disabled: false,
    });
  });

  it('blocks unmortgaging without enough cash', () => {
    expect(getMortgageButton({ ...base, isMortgaged: true, money: 109 }).disabled).toBe(true);
  });

  it('ignores houses once the tile is mortgaged', () => {
    const button = getMortgageButton({ ...base, isMortgaged: true, houses: 2, money: 500 });
    expect(button.action).toBe('unmortgage');
    expect(button.disabled).toBe(false);
  });
});
