import { describe, it, expect } from 'vitest';
import type { GameState, Player } from '@trade-tycoon/game-logic';
import { getGameOverSummary, getGameOverTitle } from './game-over';

const player = (id: string, over: Partial<Player> = {}): Player => ({
  id,
  name: id.toUpperCase(),
  color: '#123456',
  money: 1500,
  position: 0,
  isInJail: false,
  jailTurns: 0,
  properties: [],
  houses: {},
  mortgaged: [],
  getOutOfJailCards: 0,
  ...over,
});

const stateWith = (
  winner: string | null,
  players: Player[]
): Pick<GameState, 'winner' | 'players'> => ({
  winner,
  players,
});

describe('getGameOverSummary', () => {
  it('is null while the game is in progress', () => {
    expect(getGameOverSummary(stateWith(null, [player('a'), player('b')]))).toBeNull();
  });

  it('describes the winner: name, colour, cash and property count', () => {
    const summary = getGameOverSummary(
      stateWith('b', [
        player('b', { money: 3641, color: '#ff0000', properties: ['mediterranean', 'baltic'] }),
      ])
    );
    expect(summary).toEqual({
      winnerId: 'b',
      name: 'B',
      color: '#ff0000',
      cash: 3641,
      propertyCount: 2,
    });
  });

  it('still reports game over when the winner id matches nobody', () => {
    const summary = getGameOverSummary(stateWith('ghost', [player('a')]));
    expect(summary).not.toBeNull();
    expect(summary?.winnerId).toBe('ghost');
  });
});

describe('getGameOverTitle', () => {
  const summary = { winnerId: 'a', name: 'Alice' };

  it('hotseat: always names the winner (one shared device, no "you")', () => {
    expect(getGameOverTitle(summary, 'a', false)).toBe('Alice wins!');
    expect(getGameOverTitle(summary, 'b', false)).toBe('Alice wins!');
  });

  it('multiplayer as the winner: "You win!"', () => {
    expect(getGameOverTitle(summary, 'a', true)).toBe('You win!');
  });

  it('multiplayer as someone else: names the winner', () => {
    expect(getGameOverTitle(summary, 'b', true)).toBe('Alice wins!');
  });

  it('multiplayer with a missing id: names the winner', () => {
    expect(getGameOverTitle(summary, undefined, true)).toBe('Alice wins!');
    expect(getGameOverTitle(summary, '', true)).toBe('Alice wins!');
  });
});
