import { describe, it, expect } from 'vitest';
import { getDiceAccessibilityLabel } from './dice-labels';

describe('getDiceAccessibilityLabel', () => {
  it('reads both values and the total', () => {
    expect(getDiceAccessibilityLabel(3, 4, false)).toBe('Dice show 3 and 4, total 7');
  });

  it('says doubles when both match', () => {
    expect(getDiceAccessibilityLabel(5, 5, false)).toBe('Dice show 5 and 5, doubles, total 10');
  });

  it('hides the stale values while rolling', () => {
    expect(getDiceAccessibilityLabel(3, 4, true)).toBe('Rolling dice');
  });
});
