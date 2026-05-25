import { describe, it, expect } from 'vitest';
import {
  getPropertiesInGroup,
  ownsCompleteGroup,
  validateEvenBuild,
  validateEvenSell,
} from './helpers';
import type { Player } from './types';

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
