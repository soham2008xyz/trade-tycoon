import { describe, it, expect } from 'vitest';
import { getHeldCardsBadge } from './held-cards';

describe('getHeldCardsBadge', () => {
  it('is null when no cards are held, so nothing renders', () => {
    expect(getHeldCardsBadge(0)).toBeNull();
  });

  it('is null for a missing or malformed count', () => {
    expect(getHeldCardsBadge(undefined)).toBeNull();
    expect(getHeldCardsBadge(NaN)).toBeNull();
    expect(getHeldCardsBadge(-1)).toBeNull();
    expect(getHeldCardsBadge(1.5)).toBeNull();
  });

  it('uses the singular in the accessibility label for one card', () => {
    expect(getHeldCardsBadge(1)).toEqual({
      text: '×1',
      accessibilityLabel: 'Holds 1 Get Out of Jail Free card',
    });
  });

  it('uses the plural in the accessibility label for several cards', () => {
    expect(getHeldCardsBadge(2)).toEqual({
      text: '×2',
      accessibilityLabel: 'Holds 2 Get Out of Jail Free cards',
    });
  });
});
