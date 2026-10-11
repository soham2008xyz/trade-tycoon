import { describe, it, expect } from 'vitest';
import type { TurnTimer } from '@trade-tycoon/game-logic';
import {
  LOW_TIME_MS,
  formatCountdown,
  getRemainingMs,
  getTimerAccessibilityLabel,
  getTimerLabel,
  isTimeLow,
} from './turn-timer-display';

const timer = (overrides: Partial<TurnTimer> = {}): TurnTimer => ({
  kind: 'turn',
  playerId: 'p1',
  key: 'turn:p1',
  deadline: 0,
  expiresAt: 100_000,
  ...overrides,
});

describe('getRemainingMs', () => {
  it('counts down on the local clock', () => {
    expect(getRemainingMs(timer(), 70_000)).toBe(30_000);
  });

  it('never goes negative once overdue', () => {
    expect(getRemainingMs(timer(), 130_000)).toBe(0);
  });

  it('is null when there is nothing to draw', () => {
    expect(getRemainingMs(null, 0)).toBeNull();
    expect(getRemainingMs(undefined, 0)).toBeNull();
    expect(getRemainingMs(timer({ expiresAt: undefined }), 0)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it.each([
    [180_000, '3:00'],
    [65_000, '1:05'],
    [9_001, '0:10'], // partial seconds round up so 0:00 means expired
    [1, '0:01'],
    [0, '0:00'],
    [-5, '0:00'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe('isTimeLow', () => {
  it('flips at the threshold', () => {
    expect(isTimeLow(LOW_TIME_MS + 1)).toBe(false);
    expect(isTimeLow(LOW_TIME_MS)).toBe(true);
    expect(isTimeLow(0)).toBe(true);
  });
});

describe('labels', () => {
  it('says "You" on your own turn and the name otherwise', () => {
    expect(getTimerLabel(timer(), 'Bob', true, 65_000)).toBe('You · 1:05');
    expect(getTimerLabel(timer(), 'Bob', false, 65_000)).toBe('Bob · 1:05');
  });

  it('marks an auction clock as a bid clock', () => {
    const bid = timer({ kind: 'auction' });
    expect(getTimerLabel(bid, 'Bob', true, 12_000)).toBe('You (bid) · 0:12');
    expect(getTimerLabel(bid, 'Bob', false, 12_000)).toBe("Bob's bid · 0:12");
  });

  it('reads naturally to a screen reader', () => {
    expect(getTimerAccessibilityLabel(timer(), 'Bob', false, 65_000)).toBe(
      "Bob's turn time: 65 seconds left"
    );
    expect(getTimerAccessibilityLabel(timer({ kind: 'auction' }), 'Bob', true, 1_000)).toBe(
      'Your bidding time: 1 second left'
    );
  });
});
