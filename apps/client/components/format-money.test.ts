import { describe, it, expect } from 'vitest';
import { formatMoney } from './format-money';

describe('formatMoney', () => {
  it('prefixes positive amounts with a dollar sign', () => {
    expect(formatMoney(1500)).toBe('$1500');
  });

  it('shows zero without a sign', () => {
    expect(formatMoney(0)).toBe('$0');
  });

  it('puts the minus sign before the dollar sign for negative cash', () => {
    expect(formatMoney(-100)).toBe('-$100');
    expect(formatMoney(-166)).toBe('-$166');
  });
});
