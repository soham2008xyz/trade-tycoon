import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '@trade-tycoon/game-logic';
import { BOARD } from '@trade-tycoon/game-logic';
import { getStatusPanelActions } from './useStatusPanelActions';

const player = (id: string, money: number, position = 1, props: string[] = []): Player => ({
  id,
  name: id.toUpperCase(),
  color: '#000',
  money,
  position,
  isInJail: false,
  jailTurns: 0,
  properties: props,
  houses: {},
  mortgaged: [],
  getOutOfJailCards: 0,
});

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  players: [player('alice', 1500), player('bob', 1500)],
  currentPlayerId: 'alice',
  dice: [0, 0],
  doublesCount: 0,
  phase: 'roll',
  board: BOARD,
  winner: null,
  auction: null,
  activeTrade: null,
  logs: [],
  ...overrides,
});

describe('getStatusPanelActions', () => {
  it('marks it the local player turn only when ids match', () => {
    const state = baseState();
    expect(getStatusPanelActions(state, 'alice').isMyTurn).toBe(true);
    expect(getStatusPanelActions(state, 'bob').isMyTurn).toBe(false);
  });

  it('canBuy when on an unowned buyable tile during action phase with enough money', () => {
    // Position 1 = Mediterranean Avenue (id: 'mediterranean'), buyable, no owner
    const state = baseState({ phase: 'action' });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(true);
    expect(actions.canAuction).toBe(true);
  });

  it('canAuction stays true even when the player cannot afford', () => {
    const state = baseState({
      phase: 'action',
      players: [player('alice', 10), player('bob', 1500)],
    });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(false);
    expect(actions.canAuction).toBe(true);
  });

  it('canBuy is false when the property is already owned', () => {
    const state = baseState({
      phase: 'action',
      players: [player('alice', 1500, 1, []), player('bob', 1500, 0, ['mediterranean'])],
    });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(false);
    expect(actions.canAuction).toBe(false);
  });

  it('exposes the current player and current tile', () => {
    const state = baseState({ phase: 'action' });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.currentPlayer?.id).toBe('alice');
    expect(actions.currentTile?.id).toBe('mediterranean');
  });
});
