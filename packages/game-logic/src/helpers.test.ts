import { describe, it, expect } from 'vitest';
import {
  getBuildBlocker,
  getPropertiesInGroup,
  getUnmortgageCost,
  ownsCompleteGroup,
  validateEvenBuild,
  validateEvenSell,
} from './helpers';
import type { Player } from './types';
import { BOARD } from './board-data';

const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  name: 'Player 1',
  color: '#ff0000',
  money: 1500,
  position: 0,
  isInJail: false,
  jailTurns: 0,
  properties: [],
  houses: {},
  mortgaged: [],
  getOutOfJailCards: 0,
  ...overrides,
});

describe('helpers', () => {
  describe('getPropertiesInGroup', () => {
    it('returns only properties from the requested group', () => {
      const brown = getPropertiesInGroup('brown');

      expect(brown).toHaveLength(2);
      expect(brown.map((tile) => tile.id).sort()).toEqual(['baltic', 'mediterranean']);
      expect(brown.every((tile) => tile.group === 'brown')).toBe(true);
    });

    it('returns all railroads and utilities groups', () => {
      const railroads = getPropertiesInGroup('railroad');
      const utilities = getPropertiesInGroup('utility');

      expect(railroads).toHaveLength(4);
      expect(utilities).toHaveLength(2);
    });
  });

  describe('ownsCompleteGroup', () => {
    it('returns true when player owns the full color group', () => {
      const player = createPlayer({ properties: ['mediterranean', 'baltic'] });

      expect(ownsCompleteGroup(player, 'brown')).toBe(true);
    });

    it('returns false when player is missing at least one property in the group', () => {
      const player = createPlayer({ properties: ['mediterranean'] });

      expect(ownsCompleteGroup(player, 'brown')).toBe(false);
    });
  });

  describe('validateEvenBuild', () => {
    it('returns false for unknown or non-group tiles', () => {
      const player = createPlayer();

      expect(validateEvenBuild(player, 'not-a-tile')).toBe(false);
      expect(validateEvenBuild(player, 'go')).toBe(false);
    });

    it('allows building only on properties tied for minimum houses in group', () => {
      const player = createPlayer({
        houses: {
          mediterranean: 1,
          baltic: 0,
        },
      });

      expect(validateEvenBuild(player, 'baltic')).toBe(true);
      expect(validateEvenBuild(player, 'mediterranean')).toBe(false);
    });

    it('allows building when all properties in the group are even', () => {
      const player = createPlayer({
        houses: {
          mediterranean: 2,
          baltic: 2,
        },
      });

      expect(validateEvenBuild(player, 'mediterranean')).toBe(true);
      expect(validateEvenBuild(player, 'baltic')).toBe(true);
    });
  });

  describe('validateEvenSell', () => {
    it('returns false for unknown or non-group tiles', () => {
      const player = createPlayer();

      expect(validateEvenSell(player, 'not-a-tile')).toBe(false);
      expect(validateEvenSell(player, 'go')).toBe(false);
    });

    it('allows selling only from properties tied for maximum houses in group', () => {
      const player = createPlayer({
        houses: {
          mediterranean: 2,
          baltic: 1,
        },
      });

      expect(validateEvenSell(player, 'mediterranean')).toBe(true);
      expect(validateEvenSell(player, 'baltic')).toBe(false);
    });

    it('allows selling from either property when house counts are even', () => {
      const player = createPlayer({
        houses: {
          mediterranean: 1,
          baltic: 1,
        },
      });

      expect(validateEvenSell(player, 'mediterranean')).toBe(true);
      expect(validateEvenSell(player, 'baltic')).toBe(true);
    });
  });
});

describe('getBuildBlocker', () => {
  // Owns the whole brown group (Mediterranean $50/house, Baltic $50/house).
  const brownOwner = (overrides: Partial<Player> = {}): Player =>
    createPlayer({ properties: ['mediterranean', 'baltic'], ...overrides });

  it('allows an even build the player can afford', () => {
    expect(getBuildBlocker(brownOwner(), 'mediterranean')).toBeNull();
  });

  it('rejects a build that would break the even-build rule (#323)', () => {
    const player = brownOwner({ houses: { mediterranean: 1 } });

    expect(getBuildBlocker(player, 'mediterranean')).toBe(
      'You must build evenly across the color group.'
    );
    expect(getBuildBlocker(player, 'baltic')).toBeNull();
  });

  it('rejects tiles that cannot hold houses', () => {
    expect(getBuildBlocker(brownOwner(), 'not-a-tile')).toBe('Cannot build on this property.');
    expect(getBuildBlocker(brownOwner({ properties: ['reading_rr'] }), 'reading_rr')).toBe(
      'Cannot build on this property.'
    );
  });

  it('rejects a street the player does not own', () => {
    expect(getBuildBlocker(createPlayer(), 'mediterranean')).toBe('You do not own this property.');
  });

  it('rejects an incomplete color group', () => {
    expect(getBuildBlocker(createPlayer({ properties: ['mediterranean'] }), 'mediterranean')).toBe(
      'You must own the complete color group to build.'
    );
  });

  it('rejects a group with a mortgaged street', () => {
    expect(getBuildBlocker(brownOwner({ mortgaged: ['baltic'] }), 'mediterranean')).toBe(
      'Cannot build: a property in this color group is mortgaged.'
    );
  });

  it('rejects a street that already has a hotel', () => {
    const player = brownOwner({ houses: { mediterranean: 5, baltic: 5 } });

    expect(getBuildBlocker(player, 'mediterranean')).toBe('Max buildings reached.');
  });

  it('rejects a build the player cannot afford', () => {
    expect(getBuildBlocker(brownOwner({ money: 49 }), 'mediterranean')).toBe('Insufficient funds.');
  });
});

describe('getUnmortgageCost', () => {
  const distinctMortgageValues = [
    ...new Set(BOARD.flatMap((t) => (t.mortgageValue ? [t.mortgageValue] : []))),
  ];

  it('covers every mortgage value on the board', () => {
    expect(distinctMortgageValues.length).toBeGreaterThan(0);
  });

  it.each(distinctMortgageValues)('charges value + 10%% rounded up for $%i', (value) => {
    expect(getUnmortgageCost(value)).toBe(value + Math.ceil(value / 10));
  });

  it('does not overshoot where float maths would (50 * 1.1 = 55.00000000000001)', () => {
    expect(getUnmortgageCost(50)).toBe(55);
    expect(getUnmortgageCost(90)).toBe(99);
    expect(getUnmortgageCost(100)).toBe(110);
    expect(getUnmortgageCost(110)).toBe(121);
    expect(getUnmortgageCost(200)).toBe(220);
  });

  it('still rounds up when 10% is fractional', () => {
    expect(getUnmortgageCost(75)).toBe(83); // 75 + 7.5 -> 83
    expect(getUnmortgageCost(175)).toBe(193); // 175 + 17.5 -> 193
  });
});
