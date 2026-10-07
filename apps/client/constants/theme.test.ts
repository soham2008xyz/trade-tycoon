import { describe, expect, it } from 'vitest';

import { contrastRatio as contrast } from './contrast';
import { darkTheme, lightTheme, pickTheme, type Theme } from './theme';

describe('pickTheme', () => {
  it('returns the dark theme for "dark"', () => {
    expect(pickTheme('dark')).toBe(darkTheme);
  });

  it('returns the light theme for "light"', () => {
    expect(pickTheme('light')).toBe(lightTheme);
  });

  it('falls back to light when the scheme is unknown', () => {
    expect(pickTheme(null)).toBe(lightTheme);
    expect(pickTheme(undefined)).toBe(lightTheme);
  });
});

describe.each([lightTheme, darkTheme])('$scheme theme contrast', (theme: Theme) => {
  const surfaces = [theme.background, theme.surface, theme.card, theme.surfaceMuted];

  it('keeps primary and secondary text at WCAG AA (4.5:1) on every surface', () => {
    for (const bg of surfaces) {
      expect(contrast(theme.textPrimary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps error and success text readable on the surface', () => {
    expect(contrast(theme.errorText, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.successText, theme.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the highlight text readable on the selected surface', () => {
    expect(contrast(theme.highlight, theme.surfaceSelected)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the jail chip text readable on its background', () => {
    expect(contrast(theme.jailText, theme.jailBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the white label readable on the success button fill', () => {
    expect(contrast(theme.onAccent, theme.successFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the neutral button label readable', () => {
    expect(contrast(theme.onAccent, theme.neutralButton)).toBeGreaterThanOrEqual(4.5);
  });
});
