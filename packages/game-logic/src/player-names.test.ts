import { describe, it, expect } from 'vitest';
import { MAX_PLAYER_NAME_LENGTH, isValidPlayerName, normalizePlayerName } from './player-names';

describe('normalizePlayerName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizePlayerName('  Ada  ')).toBe('Ada');
  });

  it('caps the length at MAX_PLAYER_NAME_LENGTH', () => {
    const long = 'Maximilian Alexander Bartholomew Montgomery';
    expect(normalizePlayerName(long)).toBe(long.slice(0, MAX_PLAYER_NAME_LENGTH));
  });

  it('trims before capping so leading spaces do not eat the budget', () => {
    expect(normalizePlayerName('     ' + 'a'.repeat(MAX_PLAYER_NAME_LENGTH))).toBe(
      'a'.repeat(MAX_PLAYER_NAME_LENGTH)
    );
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizePlayerName('   ')).toBe('');
  });
});

describe('isValidPlayerName', () => {
  it('rejects empty and whitespace-only names', () => {
    expect(isValidPlayerName('')).toBe(false);
    expect(isValidPlayerName(' \t ')).toBe(false);
  });

  it('accepts a normal name', () => {
    expect(isValidPlayerName('Ada')).toBe(true);
  });
});
