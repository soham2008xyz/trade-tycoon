import { describe, expect, it } from 'vitest';

import { GROUP_COLORS } from './index';
import { contrastRatio, textColorOn } from './contrast';
import { darkTheme, lightTheme } from './theme';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#AAE0FA', '#AAE0FA')).toBeCloseTo(1);
  });
});

describe('textColorOn', () => {
  it('uses dark text on Light Blue (#322)', () => {
    expect(textColorOn(GROUP_COLORS.light_blue)).toBe('#000000');
  });

  it('uses light text on the dark groups', () => {
    expect(textColorOn(GROUP_COLORS.dark_blue)).toBe('#ffffff');
    expect(textColorOn(GROUP_COLORS.railroad)).toBe('#ffffff');
  });

  // Group headers in the Manage modal and the tile info banner are drawn on
  // these fills, plus `borderStrong` for an unknown group.
  const fills = [
    ...Object.entries(GROUP_COLORS),
    ['light borderStrong', lightTheme.borderStrong],
    ['dark borderStrong', darkTheme.borderStrong],
  ];

  it.each(fills)('keeps header text at WCAG AA (4.5:1) on %s', (_name, fill) => {
    expect(contrastRatio(textColorOn(fill), fill)).toBeGreaterThanOrEqual(4.5);
  });
});
