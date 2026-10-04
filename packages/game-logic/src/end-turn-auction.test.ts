import { describe, it, expect } from 'vitest';
import { ACTION_REJECTED, gameReducer, reduceGameAction } from './reducer';
import { GameState, Player } from './types';
import { BOARD } from './board-data';

const MEDITERRANEAN = BOARD.findIndex((t) => t.id === 'mediterranean');
const INCOME_TAX = BOARD.findIndex((t) => t.type === 'tax');
const JAIL = BOARD.findIndex((t) => t.type === 'jail');

const createPlayer = (id: string, name: string, position: number, money = 1500): Player => ({
  id,
  name,
  color: 'blue',
  money,
  position,
  isInJail: false,
  jailTurns: 0,
  properties: [],
  houses: {},
  mortgaged: [],
  getOutOfJailCards: 0,
});

/** p1 (the current player) stands on `position` in the action phase. */
const stateWithP1On = (position: number, overrides: Partial<GameState> = {}): GameState => ({
  players: [createPlayer('p1', 'Player 1', position), createPlayer('p2', 'Player 2', 0)],
  currentPlayerId: 'p1',
  dice: [1, 2],
  doublesCount: 0,
  phase: 'action',
  winner: null,
  auction: null,
  activeTrade: null,
  logs: [],
  ...overrides,
});

const endTurn = (state: GameState) => gameReducer(state, { type: 'END_TURN', playerId: 'p1' });

describe('END_TURN on an unowned buyable tile (#272)', () => {
  it('starts the auction and keeps the turn instead of passing play on', () => {
    const state = stateWithP1On(MEDITERRANEAN);

    const next = endTurn(state);

    expect(next.phase).toBe('auction');
    expect(next.currentPlayerId).toBe('p1');
    expect(next.auction?.propertyId).toBe('mediterranean');
    expect(next.auction?.participants).toEqual(['p1', 'p2']);
    expect(next.toastMessage).toBe('Auction started for Mediterranean Avenue!');
  });

  it('starts exactly the same auction as DECLINE_BUY', () => {
    const state = stateWithP1On(MEDITERRANEAN);

    const viaEndTurn = endTurn(state);
    const viaDecline = gameReducer(state, { type: 'DECLINE_BUY', playerId: 'p1' });

    expect(viaEndTurn.phase).toBe(viaDecline.phase);
    expect(viaEndTurn.auction).toEqual(viaDecline.auction);
    expect(viaEndTurn.toastMessage).toBe(viaDecline.toastMessage);
    expect(viaEndTurn.logs).toEqual(viaDecline.logs);
  });

  it('still starts the auction when the player cannot afford the property', () => {
    const state = stateWithP1On(MEDITERRANEAN);
    state.players[0].money = 10;

    const next = endTurn(state);

    expect(next.phase).toBe('auction');
    expect(next.currentPlayerId).toBe('p1');
  });

  it('is not an action rejection: the server persists and broadcasts it', () => {
    const next = reduceGameAction(stateWithP1On(MEDITERRANEAN), {
      type: 'END_TURN',
      playerId: 'p1',
    });

    expect(next).not.toBe(ACTION_REJECTED);
  });

  it('clears a stale error so the auction announcement is what the player sees', () => {
    const state = stateWithP1On(MEDITERRANEAN, { errorMessage: 'Insufficient funds.' });

    const next = endTurn(state);

    expect(next.phase).toBe('auction');
    expect(next.errorMessage).toBeUndefined();
    expect(next.toastMessage).toBe('Auction started for Mediterranean Avenue!');
  });

  it('ignores a repeated END_TURN while the auction is running', () => {
    const auctioning = endTurn(stateWithP1On(MEDITERRANEAN));

    const repeated = reduceGameAction(auctioning, { type: 'END_TURN', playerId: 'p1' });

    // Unchanged state is the server's rejection signal: nothing persisted or broadcast.
    expect(repeated).toBe(auctioning);
    expect(auctioning.phase).toBe('auction');
    expect(auctioning.auction).not.toBeNull();
    expect(auctioning.currentPlayerId).toBe('p1');
  });

  it('does not mutate the input state', () => {
    const state = stateWithP1On(MEDITERRANEAN);
    const snapshot = JSON.parse(JSON.stringify(state));

    endTurn(state);

    expect(state).toEqual(snapshot);
  });

  it('keeps the pending double: the player can roll again once the auction ends', () => {
    const state = stateWithP1On(MEDITERRANEAN, { doublesCount: 1, dice: [1, 1] });

    const auctioning = endTurn(state);
    expect(auctioning.doublesCount).toBe(1);

    // p1 folds, p2 folds -> no sale, back to the action phase.
    const afterP1 = gameReducer(auctioning, { type: 'CONCEDE_AUCTION', playerId: 'p1' });
    const afterP2 = gameReducer(afterP1, { type: 'CONCEDE_AUCTION', playerId: 'p2' });

    expect(afterP2.phase).toBe('action');
    expect(afterP2.currentPlayerId).toBe('p1');
    expect(afterP2.doublesCount).toBe(1);
    const continued = gameReducer(afterP2, { type: 'CONTINUE_TURN', playerId: 'p1' });
    expect(continued.phase).toBe('roll');
  });
});

describe('END_TURN after the auction it started', () => {
  it('passes play on once someone has won the property', () => {
    const auctioning = endTurn(stateWithP1On(MEDITERRANEAN));

    // p1 bids; p2 folds -> p1 wins immediately.
    const afterBid = gameReducer(auctioning, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });
    const sold = gameReducer(afterBid, { type: 'CONCEDE_AUCTION', playerId: 'p2' });
    expect(sold.phase).toBe('action');
    expect(sold.players[0].properties).toContain('mediterranean');

    const next = endTurn(sold);

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
  });

  it('passes play on after a no-sale auction instead of auctioning the tile again', () => {
    const auctioning = endTurn(stateWithP1On(MEDITERRANEAN));
    const afterP1 = gameReducer(auctioning, { type: 'CONCEDE_AUCTION', playerId: 'p1' });
    const noSale = gameReducer(afterP1, { type: 'CONCEDE_AUCTION', playerId: 'p2' });
    // Nobody bought it, so the lander is still standing on an unowned tile.
    expect(noSale.phase).toBe('action');
    expect(noSale.players.some((p) => p.properties.includes('mediterranean'))).toBe(false);

    const next = endTurn(noSale);

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
    expect(next.auction).toBeNull();
  });

  it('does not auction when a new turn starts on last turn’s unsold tile', () => {
    const auctioning = endTurn(stateWithP1On(MEDITERRANEAN));
    const afterP1 = gameReducer(auctioning, { type: 'CONCEDE_AUCTION', playerId: 'p1' });
    const noSale = gameReducer(afterP1, { type: 'CONCEDE_AUCTION', playerId: 'p2' });
    const p2Turn = endTurn(noSale);
    const p1Turn = gameReducer(p2Turn, { type: 'END_TURN', playerId: 'p2' });

    // p2 never rolled (phase 'roll'), so ending their turn just passes play on.
    expect(p1Turn.phase).toBe('roll');
    expect(p1Turn.currentPlayerId).toBe('p1');
    expect(p1Turn.auction).toBeNull();
  });
});

describe('END_TURN where no auction is due', () => {
  it('advances on an owned tile', () => {
    const state = stateWithP1On(MEDITERRANEAN);
    state.players[1].properties.push('mediterranean');

    const next = endTurn(state);

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
    expect(next.auction).toBeNull();
  });

  it('advances when the player owns the tile they stand on', () => {
    const state = stateWithP1On(MEDITERRANEAN);
    state.players[0].properties.push('mediterranean');

    const next = endTurn(state);

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
  });

  it('advances on a non-buyable tile', () => {
    const next = endTurn(stateWithP1On(INCOME_TAX));

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
    expect(next.auction).toBeNull();
  });

  it('advances for a player sitting in jail', () => {
    const state = stateWithP1On(JAIL);
    state.players[0].isInJail = true;

    const next = endTurn(state);

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
  });

  it('does not auction before the player has rolled (roll phase)', () => {
    const next = endTurn(stateWithP1On(MEDITERRANEAN, { phase: 'roll' }));

    expect(next.phase).toBe('roll');
    expect(next.currentPlayerId).toBe('p2');
    expect(next.auction).toBeNull();
  });

  it('still blocks negative funds with the existing error, even on an unowned tile', () => {
    const state = stateWithP1On(MEDITERRANEAN);
    state.players[0].money = -50;

    const next = endTurn(state);

    expect(next.phase).toBe('action');
    expect(next.auction).toBeNull();
    expect(next.currentPlayerId).toBe('p1');
    expect(next.errorMessage).toBe(
      'You cannot end your turn with negative funds. Sell, mortgage, or declare bankruptcy.'
    );
  });

  it('ignores END_TURN from a player whose turn it is not', () => {
    const state = stateWithP1On(MEDITERRANEAN);

    const next = gameReducer(state, { type: 'END_TURN', playerId: 'p2' });

    expect(next).toBe(state);
  });
});
