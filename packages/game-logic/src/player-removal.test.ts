import { describe, expect, it } from 'vitest';
import { createInitialState, createPlayer } from './index';
import { removePlayerFromGame } from './reducer';
import type { GameState } from './types';

const buildThreePlayerState = (): GameState => {
  const alice = createPlayer('p1', 'Alice');
  const bob = createPlayer('p2', 'Bob');
  const charlie = createPlayer('p3', 'Charlie');

  return {
    ...createInitialState(),
    players: [alice, bob, charlie],
    currentPlayerId: alice.id,
  };
};

describe('removePlayerFromGame', () => {
  it('removes the current player and advances the turn to the next player', () => {
    const state = buildThreePlayerState();

    const nextState = removePlayerFromGame(state, 'p1');

    expect(nextState.players.map((player) => player.id)).toEqual(['p2', 'p3']);
    expect(nextState.currentPlayerId).toBe('p2');
    expect(nextState.phase).toBe('roll');
    expect(nextState.toastMessage).toBe('Alice left the game.');
  });

  it('cancels an active trade when either trade participant leaves', () => {
    const state = {
      ...buildThreePlayerState(),
      activeTrade: {
        id: 'trade-1',
        initiatorId: 'p1',
        targetPlayerId: 'p2',
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
        status: 'pending' as const,
      },
    };

    const nextState = removePlayerFromGame(state, 'p2');

    expect(nextState.activeTrade).toBeNull();
    expect(nextState.toastMessage).toContain('Active trade cancelled.');
  });

  it('declares the remaining player the winner when a two-player game loses one player', () => {
    const alice = createPlayer('p1', 'Alice');
    const bob = createPlayer('p2', 'Bob');
    const state: GameState = {
      ...createInitialState(),
      players: [alice, bob],
      currentPlayerId: alice.id,
    };

    const nextState = removePlayerFromGame(state, 'p2');

    expect(nextState.players.map((player) => player.id)).toEqual(['p1']);
    expect(nextState.winner).toBe('p1');
    expect(nextState.currentPlayerId).toBe('p1');
    expect(nextState.toastMessage).toBe('Bob left the game. Alice wins!');
  });
});
