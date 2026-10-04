import { describe, expect, it } from 'vitest';
import { MAX_PLAYER_NAME_LENGTH, PLAYER_COLORS } from '@trade-tycoon/game-logic';
import { validateSetupPlayers } from './game-setup-validation';

const [RED, BLUE] = PLAYER_COLORS;

describe('validateSetupPlayers', () => {
  it('rejects an empty or whitespace-only name', () => {
    const empty = validateSetupPlayers([
      { name: '', color: RED },
      { name: 'B', color: BLUE },
    ]);
    expect(empty).toEqual({ ok: false, error: 'Every player needs a name.' });
    const blank = validateSetupPlayers([
      { name: 'A', color: RED },
      { name: '   ', color: BLUE },
    ]);
    expect(blank.ok).toBe(false);
  });

  it('still rejects duplicate colors', () => {
    const result = validateSetupPlayers([
      { name: 'A', color: RED },
      { name: 'B', color: RED },
    ]);
    expect(result).toEqual({ ok: false, error: 'Each player needs a different color.' });
  });

  it('trims and caps names on success', () => {
    const result = validateSetupPlayers([
      { name: '  Ann  ', color: RED },
      { name: 'x'.repeat(MAX_PLAYER_NAME_LENGTH + 10), color: BLUE },
    ]);
    expect(result).toEqual({
      ok: true,
      players: [
        { name: 'Ann', color: RED },
        { name: 'x'.repeat(MAX_PLAYER_NAME_LENGTH), color: BLUE },
      ],
    });
  });
});
