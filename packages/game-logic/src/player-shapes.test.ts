import { describe, it, expect } from 'vitest';
import { PLAYER_COLORS } from './player-colors';
import { PLAYER_SHAPES, getPlayerShape } from './player-shapes';

describe('PLAYER_SHAPES', () => {
  it('has a shape for every palette color', () => {
    expect(PLAYER_SHAPES.length).toBeGreaterThanOrEqual(PLAYER_COLORS.length);
  });

  it('has no repeated shape', () => {
    expect(new Set(PLAYER_SHAPES).size).toBe(PLAYER_SHAPES.length);
  });
});

describe('getPlayerShape', () => {
  it('gives every palette color a different shape', () => {
    const shapes = PLAYER_COLORS.map(getPlayerShape);
    expect(new Set(shapes).size).toBe(PLAYER_COLORS.length);
  });

  it('is stable for the same color', () => {
    expect(getPlayerShape(PLAYER_COLORS[3])).toBe(getPlayerShape(PLAYER_COLORS[3]));
  });

  it('compares colors case-insensitively', () => {
    expect(getPlayerShape(PLAYER_COLORS[2].toLowerCase())).toBe(getPlayerShape(PLAYER_COLORS[2]));
  });

  it('falls back to a circle for a color outside the palette', () => {
    expect(getPlayerShape('#123456')).toBe('circle');
  });
});
