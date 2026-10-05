import { describe, it, expect } from 'vitest';
import { buildLabel, sellLabel } from './building-labels';

describe('buildLabel', () => {
  it('says House for the first four builds', () => {
    for (const houses of [0, 1, 2, 3]) {
      expect(buildLabel(houses, 50)).toBe('Build House ($50)');
    }
  });

  it('says Hotel once the street has 4 houses', () => {
    expect(buildLabel(4, 50)).toBe('Build Hotel ($50)');
  });
});

describe('sellLabel', () => {
  it('says House while the street has up to 4 houses', () => {
    for (const houses of [1, 2, 3, 4]) {
      expect(sellLabel(houses, 25)).toBe('Sell House ($25)');
    }
  });

  it('says Hotel when the street has a hotel', () => {
    expect(sellLabel(5, 25)).toBe('Sell Hotel ($25)');
  });
});
