import { describe, expect, it } from 'vitest';
import { getJailStatus, getPlayerPositionLabel, getPlayerTokenLabel } from './jail-status';

describe('jail status', () => {
  it('shows zero completed failures on entry, not attempt one', () => {
    expect(getJailStatus({ isInJail: true, jailTurns: 0 })?.text).toBe(
      'In Jail · 0/3 failed rolls'
    );
  });

  it('counts completed failures and warns before the third failed roll', () => {
    const first = getJailStatus({ isInJail: true, jailTurns: 1 });
    expect(first?.text).toBe('In Jail · 1/3 failed rolls');
    expect(first?.hint).toContain('third failed roll costs $50');
    const second = getJailStatus({ isInJail: true, jailTurns: 2 });
    expect(second?.text).toBe('In Jail · 2/3 failed rolls');
    expect(second?.hint).toBe('Next roll: doubles to leave, otherwise pay $50 and move.');
  });

  it('clears jail status on release even if the token is still on tile ten', () => {
    expect(getJailStatus({ isInJail: false, jailTurns: 0 })).toBeNull();
    expect(getPlayerPositionLabel({ isInJail: false, position: 10 }, 'Jail / Just Visiting')).toBe(
      'Just Visiting'
    );
  });

  it('uses the jail flag rather than location to label a prisoner', () => {
    expect(getPlayerPositionLabel({ isInJail: true, position: 10 }, 'Jail / Just Visiting')).toBe(
      'In Jail'
    );
    expect(getPlayerPositionLabel({ isInJail: false, position: 0 }, 'GO')).toBe('GO');
  });

  it('identifies prisoners and visitors in accessible board token labels', () => {
    const player = { name: 'Alex', position: 10, isInJail: true, jailTurns: 2 };
    expect(getPlayerTokenLabel(player)).toBe('Alex. In Jail. 2 of 3 failed rolls used.');
    expect(getPlayerTokenLabel({ ...player, isInJail: false })).toBe('Alex. Just Visiting.');
    expect(getPlayerTokenLabel({ ...player, isInJail: false, position: 0 })).toBe('Alex');
  });
});
