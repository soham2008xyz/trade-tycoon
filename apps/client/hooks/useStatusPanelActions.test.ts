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
  it('marks it as the local player’s turn only when ids match', () => {
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

  describe('buttons map', () => {
    it('shows Roll Dice only during the roll phase, only on my turn', () => {
      const myTurnRoll = baseState({ phase: 'roll' });
      expect(getStatusPanelActions(myTurnRoll, 'alice').buttons.roll.visible).toBe(true);

      const myTurnAction = baseState({ phase: 'action' });
      expect(getStatusPanelActions(myTurnAction, 'alice').buttons.roll.visible).toBe(false);

      const opponentTurn = baseState({ phase: 'roll' });
      expect(getStatusPanelActions(opponentTurn, 'bob').buttons.roll.visible).toBe(false);
    });

    it('shows Pay Fine when jailed during roll; enabled flips on $50 affordability', () => {
      const jailedRich = baseState({
        phase: 'roll',
        players: [{ ...player('alice', 100), isInJail: true, jailTurns: 1 }, player('bob', 1500)],
      });
      const richActions = getStatusPanelActions(jailedRich, 'alice').buttons.payFine;
      expect(richActions.visible).toBe(true);
      expect(richActions.enabled).toBe(true);

      const jailedBroke = baseState({
        phase: 'roll',
        players: [{ ...player('alice', 10), isInJail: true, jailTurns: 1 }, player('bob', 1500)],
      });
      const brokeActions = getStatusPanelActions(jailedBroke, 'alice').buttons.payFine;
      expect(brokeActions.visible).toBe(true);
      expect(brokeActions.enabled).toBe(false);

      const free = baseState({ phase: 'roll' });
      expect(getStatusPanelActions(free, 'alice').buttons.payFine.visible).toBe(false);
    });

    it('shows Use Get-Out-of-Jail Card only when jailed AND holding ≥1 card', () => {
      const jailedNoCard = baseState({
        phase: 'roll',
        players: [{ ...player('alice', 100), isInJail: true, jailTurns: 1 }, player('bob', 1500)],
      });
      expect(getStatusPanelActions(jailedNoCard, 'alice').buttons.useGOOJCard.visible).toBe(false);

      const jailedWithCard = baseState({
        phase: 'roll',
        players: [
          { ...player('alice', 100), isInJail: true, jailTurns: 1, getOutOfJailCards: 2 },
          player('bob', 1500),
        ],
      });
      const gooj = getStatusPanelActions(jailedWithCard, 'alice').buttons.useGOOJCard;
      expect(gooj.visible).toBe(true);
      expect(gooj.count).toBe(2);
    });

    it('shows Declare Bankruptcy whenever the active player is in the red, in either phase', () => {
      const bankruptRoll = baseState({
        phase: 'roll',
        players: [player('alice', -50), player('bob', 1500)],
      });
      expect(getStatusPanelActions(bankruptRoll, 'alice').buttons.declareBankruptcy.visible).toBe(
        true
      );

      const bankruptAction = baseState({
        phase: 'action',
        players: [player('alice', -1), player('bob', 1500)],
      });
      expect(getStatusPanelActions(bankruptAction, 'alice').buttons.declareBankruptcy.visible).toBe(
        true
      );

      const solvent = baseState({ phase: 'action' });
      expect(getStatusPanelActions(solvent, 'alice').buttons.declareBankruptcy.visible).toBe(false);
    });

    it('shows Manage and End Turn outside doubles; flips to Roll Again under doubles', () => {
      const noDoubles = baseState({ phase: 'action', doublesCount: 0 });
      const a = getStatusPanelActions(noDoubles, 'alice').buttons;
      expect(a.manage.visible).toBe(true);
      expect(a.endTurn.visible).toBe(true);
      expect(a.rollAgain.visible).toBe(false);

      const doubles = baseState({ phase: 'action', doublesCount: 1 });
      const b = getStatusPanelActions(doubles, 'alice').buttons;
      expect(b.manage.visible).toBe(false);
      expect(b.endTurn.visible).toBe(false);
      expect(b.rollAgain.visible).toBe(true);
    });

    it('hides every action-phase button while a player token is animating', () => {
      const action = baseState({ phase: 'action' });
      const moving = getStatusPanelActions(action, 'alice', true).buttons;
      expect(moving.buy.visible).toBe(false);
      expect(moving.auction.visible).toBe(false);
      expect(moving.manage.visible).toBe(false);
      expect(moving.endTurn.visible).toBe(false);
      expect(moving.rollAgain.visible).toBe(false);

      // Roll-phase buttons are unaffected by token movement (the roll precedes any animation).
      const rollMoving = getStatusPanelActions(baseState({ phase: 'roll' }), 'alice', true).buttons;
      expect(rollMoving.roll.visible).toBe(true);
    });

    it('shows the waiting placeholder when it is someone else’s turn', () => {
      const state = baseState();
      expect(getStatusPanelActions(state, 'bob').buttons.waiting.visible).toBe(true);
      expect(getStatusPanelActions(state, 'alice').buttons.waiting.visible).toBe(false);
    });

    it('exposes the buy price so callers can render it without re-reading the board', () => {
      // Mediterranean Avenue costs $60.
      const state = baseState({ phase: 'action' });
      const buy = getStatusPanelActions(state, 'alice').buttons.buy;
      expect(buy.visible).toBe(true);
      expect(buy.price).toBe(60);
    });
  });
});
