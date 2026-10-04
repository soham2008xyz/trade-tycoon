import { describe, it, expect } from 'vitest';
import {
  PLAYER_COLORS,
  hasDuplicateColors,
  isColorTakenByOthers,
  pickUnusedColor,
} from './player-colors';

const [RED, BLUE, GREEN] = PLAYER_COLORS;

describe('isColorTakenByOthers', () => {
  const players = [{ color: RED }, { color: BLUE }];

  it('is true for a color another player holds', () => {
    expect(isColorTakenByOthers(players, 1, RED)).toBe(true);
    expect(isColorTakenByOthers(players, 0, BLUE)).toBe(true);
  });

  it("is false for the player's own color so it stays selectable", () => {
    expect(isColorTakenByOthers(players, 0, RED)).toBe(false);
  });

  it('is false for a color nobody holds', () => {
    expect(isColorTakenByOthers(players, 0, GREEN)).toBe(false);
  });

  it('compares case-insensitively', () => {
    expect(isColorTakenByOthers(players, 1, RED.toLowerCase())).toBe(true);
  });
});

describe('pickUnusedColor', () => {
  it('returns the first palette color nobody holds', () => {
    expect(pickUnusedColor([{ color: RED }, { color: BLUE }])).toBe(GREEN);
  });

  it('skips colors a player picked out of palette order', () => {
    expect(pickUnusedColor([{ color: RED }, { color: GREEN }])).toBe(BLUE);
  });

  it('never repeats a color across every palette slot', () => {
    const players: { color: string }[] = [];
    for (let i = 0; i < PLAYER_COLORS.length; i++) {
      players.push({ color: pickUnusedColor(players) });
    }
    expect(hasDuplicateColors(players)).toBe(false);
  });

  it('falls back to the first color when the palette is exhausted', () => {
    expect(pickUnusedColor(PLAYER_COLORS.map((color) => ({ color })))).toBe(RED);
  });
});

describe('hasDuplicateColors', () => {
  it('is false when every color is distinct', () => {
    expect(hasDuplicateColors([{ color: RED }, { color: BLUE }])).toBe(false);
  });

  it('is true when two players share a color', () => {
    expect(hasDuplicateColors([{ color: RED }, { color: RED }])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(hasDuplicateColors([{ color: RED }, { color: RED.toLowerCase() }])).toBe(true);
  });
});
