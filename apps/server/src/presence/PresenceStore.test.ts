import { describe, it, expect } from 'vitest';
import { PRESENCE_TIMEOUT_MS, getDisconnectedPlayerIds } from './PresenceStore';

describe('getDisconnectedPlayerIds', () => {
  const now = 1_000_000;

  it('flags a player unseen for longer than the timeout', () => {
    const lastSeen = new Map([['a', now - PRESENCE_TIMEOUT_MS - 1]]);
    expect(getDisconnectedPlayerIds(['a'], lastSeen, now)).toEqual(['a']);
  });

  it('does not flag a recently seen player', () => {
    const lastSeen = new Map([['a', now - 1_000]]);
    expect(getDisconnectedPlayerIds(['a'], lastSeen, now)).toEqual([]);
  });

  it('treats exactly the timeout as still connected (strictly greater)', () => {
    const lastSeen = new Map([['a', now - PRESENCE_TIMEOUT_MS]]);
    expect(getDisconnectedPlayerIds(['a'], lastSeen, now)).toEqual([]);
  });

  it('treats a player with no record as connected', () => {
    expect(getDisconnectedPlayerIds(['a'], new Map(), now)).toEqual([]);
  });

  it('only reports ids from the given roster, preserving its order', () => {
    const stale = now - PRESENCE_TIMEOUT_MS - 1;
    const lastSeen = new Map([
      ['a', stale],
      ['b', now],
      ['c', stale],
      ['gone', stale],
    ]);
    expect(getDisconnectedPlayerIds(['c', 'b', 'a'], lastSeen, now)).toEqual(['c', 'a']);
  });

  it('does not read inherited Object.prototype members for hostile ids', () => {
    expect(
      getDisconnectedPlayerIds(['__proto__', 'constructor', 'toString'], new Map(), now)
    ).toEqual([]);
  });
});
