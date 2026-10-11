import { describe, it, expect } from 'vitest';
import { reduceGameAction, ACTION_REJECTED } from './reducer';
import { BOARD } from './board-data';
import {
  DEFAULT_TURN_TIMER_CONFIG,
  expireTurnTimer,
  getTimerSubject,
  isTurnTimerExpired,
  localizeTurnTimer,
  stampTurnTimer,
} from './turn-timer';
import type { GameState, Player } from './types';

const MEDITERRANEAN = BOARD.findIndex((t) => t.id === 'mediterranean');
const CONFIG = { turnLimitMs: 60_000, auctionLimitMs: 10_000 };
const NOW = 5_000_000;
const rng = () => 0.5;

const player = (id: string, position = 0, money = 1500): Player => ({
  id,
  name: id.toUpperCase(),
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

const game = (overrides: Partial<GameState> = {}): GameState => ({
  players: [player('a'), player('b'), player('c')],
  currentPlayerId: 'a',
  dice: [1, 2],
  doublesCount: 0,
  phase: 'roll',
  winner: null,
  auction: null,
  activeTrade: null,
  logs: [],
  timerConfig: CONFIG,
  ...overrides,
});

const act = (state: GameState, action: Parameters<typeof reduceGameAction>[1]): GameState => {
  const result = reduceGameAction(state, action, rng);
  if (result === ACTION_REJECTED) throw new Error('rejected');
  return result;
};

describe('stampTurnTimer', () => {
  it('arms the turn clock with the turn limit', () => {
    const stamped = stampTurnTimer(game(), NOW);

    expect(stamped.timer).toEqual({
      kind: 'turn',
      playerId: 'a',
      key: 'turn:a',
      deadline: NOW + CONFIG.turnLimitMs,
    });
  });

  it('does nothing without a config (hotseat, rooms saved before timers)', () => {
    const state = game({ timerConfig: undefined });

    expect(stampTurnTimer(state, NOW)).toBe(state);
  });

  it('keeps the same reference and deadline while the subject is unchanged', () => {
    const stamped = stampTurnTimer(game(), NOW);

    expect(stampTurnTimer(stamped, NOW + 30_000)).toBe(stamped);
  });

  it('does not extend the turn when the player rolls doubles or acts within it', () => {
    const stamped = stampTurnTimer(game(), NOW);
    const rolled = act(stamped, { type: 'ROLL_DICE', playerId: 'a', die1: 1, die2: 2 });

    expect(stampTurnTimer(rolled, NOW + 20_000).timer?.deadline).toBe(NOW + CONFIG.turnLimitMs);
  });

  it('re-arms the clock when the turn passes to the next player', () => {
    const stamped = stampTurnTimer(game({ phase: 'action' }), NOW);
    const ended = act(stamped, { type: 'END_TURN', playerId: 'a' });

    const next = stampTurnTimer(ended, NOW + 15_000);

    expect(next.timer).toMatchObject({
      kind: 'turn',
      playerId: 'b',
      deadline: NOW + 15_000 + CONFIG.turnLimitMs,
    });
  });

  it('times each bidder separately and re-arms on every bid or pass', () => {
    let state = stampTurnTimer(game({ phase: 'action' }), NOW);
    state = act(
      { ...state, players: [player('a', MEDITERRANEAN), player('b'), player('c')] },
      {
        type: 'DECLINE_BUY',
        playerId: 'a',
      }
    );
    state = stampTurnTimer(state, NOW + 1_000);
    expect(state.timer).toMatchObject({
      kind: 'auction',
      playerId: 'a',
      deadline: NOW + 1_000 + CONFIG.auctionLimitMs,
    });

    state = stampTurnTimer(
      act(state, { type: 'PLACE_BID', playerId: 'a', amount: 10 }),
      NOW + 4_000
    );
    expect(state.timer).toMatchObject({ kind: 'auction', playerId: 'b' });
    expect(state.timer?.deadline).toBe(NOW + 4_000 + CONFIG.auctionLimitMs);

    state = stampTurnTimer(act(state, { type: 'CONCEDE_AUCTION', playerId: 'b' }), NOW + 6_000);
    expect(state.timer).toMatchObject({ kind: 'auction', playerId: 'c' });
    expect(state.timer?.deadline).toBe(NOW + 6_000 + CONFIG.auctionLimitMs);
  });

  it('restarts the turn clock once the auction is over', () => {
    const state = stampTurnTimer(
      game({
        phase: 'action',
        players: [player('a', MEDITERRANEAN), player('b'), player('c')],
      }),
      NOW
    );
    let auctioned = stampTurnTimer(act(state, { type: 'DECLINE_BUY', playerId: 'a' }), NOW + 1_000);
    auctioned = act(auctioned, { type: 'CONCEDE_AUCTION', playerId: 'a' });
    auctioned = act(auctioned, { type: 'CONCEDE_AUCTION', playerId: 'b' });
    auctioned = act(auctioned, { type: 'CONCEDE_AUCTION', playerId: 'c' });
    expect(auctioned.phase).toBe('action');

    const back = stampTurnTimer(auctioned, NOW + 9_000);

    expect(back.timer).toMatchObject({ kind: 'turn', playerId: 'a' });
    expect(back.timer?.deadline).toBe(NOW + 9_000 + CONFIG.turnLimitMs);
  });

  it('clears the clock when the game has a winner', () => {
    const stamped = stampTurnTimer(game(), NOW);

    expect(stampTurnTimer({ ...stamped, winner: 'a' }, NOW).timer).toBeNull();
  });

  it('treats a 0 limit as that timer being disabled, independently of the other', () => {
    const noTurnLimit = game({ timerConfig: { turnLimitMs: 0, auctionLimitMs: 10_000 } });
    expect(stampTurnTimer(noTurnLimit, NOW).timer).toBeUndefined();

    const noAuctionLimit = game({
      timerConfig: { turnLimitMs: 60_000, auctionLimitMs: 0 },
      phase: 'auction',
      auction: {
        propertyId: 'mediterranean',
        currentBid: 0,
        highestBidderId: null,
        participants: ['a', 'b'],
        currentBidderIndex: 0,
      },
    });
    expect(stampTurnTimer(noAuctionLimit, NOW).timer).toBeUndefined();
  });

  it('ships sensible defaults', () => {
    expect(DEFAULT_TURN_TIMER_CONFIG.turnLimitMs).toBeGreaterThan(
      DEFAULT_TURN_TIMER_CONFIG.auctionLimitMs
    );
    expect(DEFAULT_TURN_TIMER_CONFIG.auctionLimitMs).toBeGreaterThan(0);
  });
});

describe('getTimerSubject', () => {
  it('is null when there is nothing to time', () => {
    expect(getTimerSubject(game({ players: [], currentPlayerId: '' }))).toBeNull();
    expect(getTimerSubject(game({ winner: 'a' }))).toBeNull();
  });
});

describe('expireTurnTimer', () => {
  it('returns null while the deadline has not passed (and exactly at it, expires)', () => {
    const stamped = stampTurnTimer(game(), NOW);
    const deadline = NOW + CONFIG.turnLimitMs;

    expect(isTurnTimerExpired(stamped, deadline - 1)).toBe(false);
    expect(expireTurnTimer(stamped, deadline - 1, rng)).toBeNull();
    expect(isTurnTimerExpired(stamped, deadline)).toBe(true);
    expect(expireTurnTimer(stamped, deadline, rng)).not.toBeNull();
  });

  it('skips the idle player and starts the next player a fresh clock from now', () => {
    const stamped = stampTurnTimer(game(), NOW);
    const later = NOW + CONFIG.turnLimitMs + 7_000;

    const next = expireTurnTimer(stamped, later, rng);

    expect(next?.currentPlayerId).toBe('b');
    expect(next?.phase).toBe('roll');
    expect(next?.timer).toMatchObject({ playerId: 'b', deadline: later + CONFIG.turnLimitMs });
    expect(next?.toastMessage).toContain('A ran out of time');
    expect(next?.logs.at(-1)).toBe('[Game] A ran out of time. Turn skipped.');
  });

  it('takes one step even when several deadlines have long passed', () => {
    const stamped = stampTurnTimer(game(), NOW);

    const next = expireTurnTimer(stamped, NOW + 10 * CONFIG.turnLimitMs, rng);

    expect(next?.currentPlayerId).toBe('b');
  });

  it('skips a player who is in debt, who cannot end their turn normally', () => {
    const stamped = stampTurnTimer(
      game({ phase: 'action', players: [player('a', 0, -50), player('b'), player('c')] }),
      NOW
    );

    const next = expireTurnTimer(stamped, NOW + CONFIG.turnLimitMs, rng);

    expect(next?.currentPlayerId).toBe('b');
    expect(next?.players[0].money).toBe(-50);
  });

  it('auctions the property when the player times out standing on an unowned one', () => {
    const stamped = stampTurnTimer(
      game({ phase: 'action', players: [player('a', MEDITERRANEAN), player('b'), player('c')] }),
      NOW
    );
    const later = NOW + CONFIG.turnLimitMs;

    const next = expireTurnTimer(stamped, later, rng);

    expect(next?.phase).toBe('auction');
    expect(next?.currentPlayerId).toBe('a');
    // The auction runs on its own, shorter clock, starting at the first bidder.
    expect(next?.timer).toMatchObject({
      kind: 'auction',
      playerId: 'a',
      deadline: later + CONFIG.auctionLimitMs,
    });
  });

  it('passes an idle bidder and moves the auction clock to the next bidder', () => {
    let state = stampTurnTimer(
      game({ phase: 'action', players: [player('a', MEDITERRANEAN), player('b'), player('c')] }),
      NOW
    );
    state = stampTurnTimer(act(state, { type: 'DECLINE_BUY', playerId: 'a' }), NOW);
    state = stampTurnTimer(act(state, { type: 'PLACE_BID', playerId: 'a', amount: 10 }), NOW);
    const later = NOW + CONFIG.auctionLimitMs;

    const next = expireTurnTimer(state, later, rng);

    expect(next?.auction?.participants).toEqual(['a', 'c']);
    expect(next?.timer).toMatchObject({ kind: 'auction', playerId: 'c' });
    expect(next?.timer?.deadline).toBe(later + CONFIG.auctionLimitMs);
    expect(next?.logs.at(-1)).toBe('[Game] B ran out of time and passed.');
  });

  it('awards the property when the last rival times out against a standing bid', () => {
    const auctionState = (): GameState =>
      game({
        phase: 'auction',
        players: [player('a', MEDITERRANEAN), player('b')],
        auction: {
          propertyId: 'mediterranean',
          currentBid: 40,
          highestBidderId: 'a',
          participants: ['a', 'b'],
          currentBidderIndex: 1,
        },
      });
    const stamped = stampTurnTimer(auctionState(), NOW);

    const next = expireTurnTimer(stamped, NOW + CONFIG.auctionLimitMs, rng);

    expect(next?.phase).toBe('action');
    expect(next?.auction).toBeNull();
    expect(next?.players[0].properties).toContain('mediterranean');
    expect(next?.players[0].money).toBe(1460);
    expect(next?.timer).toMatchObject({ kind: 'turn', playerId: 'a' });
  });

  it('settles in favour of the high bidder if it is somehow their own turn to pass', () => {
    const stamped = stampTurnTimer(
      game({
        phase: 'auction',
        players: [player('a', MEDITERRANEAN), player('b')],
        auction: {
          propertyId: 'mediterranean',
          currentBid: 40,
          highestBidderId: 'a',
          participants: ['a', 'b'],
          currentBidderIndex: 0,
        },
      }),
      NOW
    );

    const next = expireTurnTimer(stamped, NOW + CONFIG.auctionLimitMs, rng);

    expect(next?.auction).toBeNull();
    expect(next?.players[0].properties).toContain('mediterranean');
  });

  it('does nothing after the game is won', () => {
    const stamped = stampTurnTimer(game(), NOW);

    expect(
      expireTurnTimer({ ...stamped, winner: 'a' }, NOW + 10 * CONFIG.turnLimitMs, rng)
    ).toBeNull();
  });

  it('is a no-op without a timer', () => {
    expect(expireTurnTimer(game(), NOW, rng)).toBeNull();
  });
});

describe('localizeTurnTimer', () => {
  it('anchors the local expiry on the server-computed remaining time, ignoring clock skew', () => {
    const state = game({
      timer: {
        kind: 'turn',
        playerId: 'a',
        key: 'turn:a',
        deadline: 9_999_999_999,
        remainingMs: 42_000,
      },
    });

    const local = localizeTurnTimer(state, 1_000);

    expect(local.timer?.expiresAt).toBe(43_000);
  });

  it('leaves a state without a wire timer untouched', () => {
    const state = game();

    expect(localizeTurnTimer(state, 1_000)).toBe(state);
  });
});
