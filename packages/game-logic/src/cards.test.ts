import { describe, it, expect } from 'vitest';
import { processCardEffect, Card } from './cards';
import { Player } from './types';

describe('processCardEffect', () => {
  const mockPlayer: Player = {
    id: 'player-1',
    name: 'Player 1',
    color: 'red',
    money: 1000,
    position: 0,
    isInJail: false,
    jailTurns: 0,
    properties: [],
    houses: {},
    mortgaged: [],
    getOutOfJailCards: 0,
  };

  it('should calculate repairs cost correctly for houses and hotels', () => {
    const playerWithHouses: Player = {
      ...mockPlayer,
      houses: {
        'prop-1': 2, // 2 houses
        'prop-2': 5, // 1 hotel
        'prop-3': 4, // 4 houses
      },
    };

    // Total houses: 2 + 4 = 6
    // Total hotels: 1

    const repairCard: Card = {
      id: 'test-repair',
      text: 'Pay for repairs',
      action: {
        type: 'REPAIRS',
        houseCost: 40,
        hotelCost: 115,
      },
    };

    const { player: updatedPlayer } = processCardEffect(playerWithHouses, repairCard);

    // Cost: (6 * 40) + (1 * 115) = 240 + 115 = 355
    expect(updatedPlayer.money).toBe(1000 - 355);
  });

  it('should handle no houses/hotels correctly (0 cost)', () => {
    const playerNoHouses: Player = {
      ...mockPlayer,
      houses: {},
    };

    const repairCard: Card = {
      id: 'test-repair',
      text: 'Pay for repairs',
      action: {
        type: 'REPAIRS',
        houseCost: 40,
        hotelCost: 115,
      },
    };

    const { player: updatedPlayer } = processCardEffect(playerNoHouses, repairCard);

    expect(updatedPlayer.money).toBe(1000);
  });

  describe('MOVE_TO with collectGo', () => {
    const advanceToGo: Card = {
      id: 'c1',
      text: 'Advance to GO',
      action: { type: 'MOVE_TO', position: 0, collectGo: true },
    };

    it('should pay $200 when wrapping past GO from a higher index', () => {
      const player: Player = { ...mockPlayer, position: 36 };
      const { player: updated } = processCardEffect(player, advanceToGo);
      expect(updated.position).toBe(0);
      expect(updated.money).toBe(1200); // 1000 + 200
    });

    it('should pay $200 even when player is already AT GO (regression)', () => {
      // Edge case: previously `position < newPosition` failed for position === 0,
      // so the player got an "Advance to GO" card without collecting $200.
      const player: Player = { ...mockPlayer, position: 0 };
      const { player: updated } = processCardEffect(player, advanceToGo);
      expect(updated.position).toBe(0);
      expect(updated.money).toBe(1200);
    });

    it('should NOT pay $200 when advancing forward without crossing GO', () => {
      const advanceToBoardwalk: Card = {
        id: 'c8',
        text: 'Advance to Boardwalk',
        action: { type: 'MOVE_TO', position: 39 },
      };
      const player: Player = { ...mockPlayer, position: 1 };
      const { player: updated } = processCardEffect(player, advanceToBoardwalk);
      expect(updated.position).toBe(39);
      expect(updated.money).toBe(1000);
    });
  });
});
