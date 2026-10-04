import { describe, it, expect } from 'vitest';
import {
  MAX_PLAYER_NAME_LENGTH,
  isValidPlayerName,
  limitPlayerNameInput,
  normalizePlayerName,
} from './player-names';

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

  it('rejects names made only of invisible format/control characters', () => {
    expect(isValidPlayerName('\u200B')).toBe(false);
    expect(isValidPlayerName(' \u200B\u200D\u2060 ')).toBe(false);
    expect(isValidPlayerName('\u0007')).toBe(false);
  });

  it('keeps format characters inside an otherwise visible name', () => {
    expect(isValidPlayerName('A\u200BB')).toBe(true);
  });
});

describe('limitPlayerNameInput', () => {
  it('drops leading whitespace before capping so no visible characters are lost', () => {
    const letters = 'a'.repeat(MAX_PLAYER_NAME_LENGTH);
    expect(limitPlayerNameInput('     ' + letters)).toBe(letters);
  });

  it('caps long input', () => {
    expect(limitPlayerNameInput('x'.repeat(40))).toBe('x'.repeat(MAX_PLAYER_NAME_LENGTH));
  });

  it('keeps inner and trailing spaces so multi-word names can be typed', () => {
    expect(limitPlayerNameInput('Ann ')).toBe('Ann ');
    expect(limitPlayerNameInput('Ann Lee')).toBe('Ann Lee');
  });
});
