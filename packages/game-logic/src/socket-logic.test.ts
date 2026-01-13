import { describe, it, expect } from 'vitest';
import { gameReducer } from './reducer';
import { createInitialState } from './game-setup';
import { GameAction } from './types';

describe('Game Reducer with GameAction', () => {
  it('should handle standard actions correctly', () => {
    let state = createInitialState();

    // Test Join
    const joinAction: GameAction = { type: 'JOIN_GAME', playerId: 'p1', name: 'Player 1' };
    state = gameReducer(state, joinAction);
    expect(state.players).toHaveLength(1);
    expect(state.players[0].id).toBe('p1');

    // Test Roll
    state.phase = 'roll';
    state.currentPlayerId = 'p1';
    const rollAction: GameAction = { type: 'ROLL_DICE', playerId: 'p1', die1: 1, die2: 2 };
    state = gameReducer(state, rollAction);

    expect(state.dice).toEqual([1, 2]);
    expect(state.phase).toBe('action');
  });

  it('should ignore actions from wrong player', () => {
    let state = createInitialState();
    const joinAction: GameAction = { type: 'JOIN_GAME', playerId: 'p1', name: 'Player 1' };
    state = gameReducer(state, joinAction);
    state.currentPlayerId = 'p1';
    state.phase = 'roll';

    const rollAction: GameAction = { type: 'ROLL_DICE', playerId: 'p2', die1: 1, die2: 2 }; // p2 tries to roll
    const newState = gameReducer(state, rollAction);

    // State should not change
    expect(newState).toEqual(state);
  });
});
