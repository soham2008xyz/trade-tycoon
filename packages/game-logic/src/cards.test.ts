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
});
