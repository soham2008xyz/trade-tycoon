import { describe, it, expect } from 'vitest';
import { parseGameAction } from './validate-action';

const offer = (overrides: Record<string, unknown> = {}) => ({
  money: 0,
  properties: [],
  getOutOfJailCards: 0,
  ...overrides,
});

describe('parseGameAction', () => {
  describe('non-object and unknown inputs', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a string', 'ROLL_DICE'],
      ['a number', 42],
      ['an array', []],
      ['missing type', { playerId: 'p1' }],
      ['non-string type', { type: 7, playerId: 'p1' }],
      ['unknown type', { type: 'NOT_A_REAL_ACTION', playerId: 'p1' }],
    ])('rejects %s', (_label, input) => {
      expect(parseGameAction(input)).toBeNull();
    });
  });

  describe('server-issued and client-local action types', () => {
    it.each([
      // Server-issued only: a client must never be able to send these.
      ['JOIN_GAME', { type: 'JOIN_GAME', player: { id: 'x', name: 'X' } }],
      ['RESET_GAME', { type: 'RESET_GAME', players: [] }],
      // Client-local UI concerns: dismissal never travels over the network,
      // otherwise any player could clear a toast for the whole room.
      ['DISMISS_ERROR', { type: 'DISMISS_ERROR' }],
      ['DISMISS_TOAST', { type: 'DISMISS_TOAST' }],
    ])('rejects %s', (_label, input) => {
      expect(parseGameAction(input)).toBeNull();
    });
  });

  describe('playerId-only actions', () => {
    const types = [
      'ROLL_DICE',
      'END_TURN',
      'PAY_FINE',
      'USE_GOOJ_CARD',
      'CONTINUE_TURN',
      'DECLARE_BANKRUPTCY',
      'DECLINE_BUY',
      'CONCEDE_AUCTION',
      'ACCEPT_TRADE',
      'REJECT_TRADE',
      'CANCEL_TRADE',
    ];

    it.each(types)('accepts %s with a playerId', (type) => {
      expect(parseGameAction({ type, playerId: 'p1' })).toEqual({ type, playerId: 'p1' });
    });

    it.each(types)('rejects %s without a playerId', (type) => {
      expect(parseGameAction({ type })).toBeNull();
      expect(parseGameAction({ type, playerId: '' })).toBeNull();
      expect(parseGameAction({ type, playerId: 42 })).toBeNull();
    });

    it('strips unknown extra fields (e.g. client-supplied dice)', () => {
      expect(parseGameAction({ type: 'ROLL_DICE', playerId: 'p1', die1: 6, die2: 6 })).toEqual({
        type: 'ROLL_DICE',
        playerId: 'p1',
      });
    });
  });

  describe('property actions', () => {
    const types = [
      'BUY_PROPERTY',
      'BUILD_HOUSE',
      'SELL_HOUSE',
      'MORTGAGE_PROPERTY',
      'UNMORTGAGE_PROPERTY',
    ];

    it.each(types)('accepts %s with playerId and propertyId', (type) => {
      expect(parseGameAction({ type, playerId: 'p1', propertyId: 't5' })).toEqual({
        type,
        playerId: 'p1',
        propertyId: 't5',
      });
    });

    it.each(types)('rejects %s without a propertyId', (type) => {
      expect(parseGameAction({ type, playerId: 'p1' })).toBeNull();
      expect(parseGameAction({ type, playerId: 'p1', propertyId: 9 })).toBeNull();
    });
  });

  describe('PLACE_BID amount bounds', () => {
    it.each([
      ['zero', 0],
      ['a positive integer', 250],
      ['the maximum (1e9)', 1_000_000_000],
    ])('accepts %s', (_label, amount) => {
      expect(parseGameAction({ type: 'PLACE_BID', playerId: 'p1', amount })).toEqual({
        type: 'PLACE_BID',
        playerId: 'p1',
        amount,
      });
    });

    it.each([
      ['a negative amount', -1],
      ['a float', 10.5],
      ['a numeric string', '100'],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['above the maximum', 1_000_000_001],
      ['an unsafe integer', Number.MAX_SAFE_INTEGER + 1],
      ['a missing amount', undefined],
    ])('rejects %s', (_label, amount) => {
      expect(parseGameAction({ type: 'PLACE_BID', playerId: 'p1', amount })).toBeNull();
    });
  });

  describe('PROPOSE_TRADE offers', () => {
    const base = {
      type: 'PROPOSE_TRADE',
      playerId: 'p1',
      targetPlayerId: 'p2',
      offer: offer(),
      request: offer(),
    };

    it('accepts a well-formed trade', () => {
      const action = {
        ...base,
        offer: offer({ money: 100, properties: ['t1', 't3'] }),
        request: offer({ getOutOfJailCards: 1 }),
      };
      expect(parseGameAction(action)).toEqual(action);
    });

    it.each([
      ['a negative money offer', { offer: offer({ money: -5000 }) }],
      ['a string money offer', { offer: offer({ money: '100' }) }],
      ['a float money offer', { offer: offer({ money: 0.5 }) }],
      ['money above the maximum', { offer: offer({ money: 1_000_000_001 }) }],
      ['negative money on the request side', { request: offer({ money: -1 }) }],
      ['non-array properties', { offer: offer({ properties: 't1' }) }],
      ['non-string property entries', { offer: offer({ properties: [1, 2] }) }],
      ['negative jail cards', { offer: offer({ getOutOfJailCards: -1 }) }],
      ['a missing offer', { offer: undefined }],
      ['a missing request', { request: undefined }],
      ['a missing targetPlayerId', { targetPlayerId: undefined }],
    ])('rejects %s', (_label, overrides) => {
      expect(parseGameAction({ ...base, ...overrides })).toBeNull();
    });
  });
});
