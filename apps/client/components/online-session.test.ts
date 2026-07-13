import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readStoredSession, writeStoredSession, clearStoredSession } from './online-session';

/**
 * The test environment is Node (no DOM); the platform is injected as a plain
 * parameter, so these tests exercise the web branch by passing 'web' and stub
 * a minimal in-memory localStorage for it.
 */
const makeMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  } as Storage;
};

describe('online-session', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeMemoryStorage());
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredSession('web')).toBeNull();
  });

  it('round-trips a written session', () => {
    writeStoredSession('web', { roomId: 'ABCD1234', playerId: 'p1', token: 'secret-token' });
    expect(readStoredSession('web')).toEqual({
      roomId: 'ABCD1234',
      playerId: 'p1',
      token: 'secret-token',
    });
  });

  it('clears the stored session', () => {
    writeStoredSession('web', { roomId: 'ABCD1234', playerId: 'p1', token: 'secret-token' });
    clearStoredSession('web');
    expect(readStoredSession('web')).toBeNull();
  });

  it('never touches storage on native platforms', () => {
    writeStoredSession('ios', { roomId: 'ABCD1234', playerId: 'p1', token: 'secret-token' });
    expect(readStoredSession('web')).toBeNull();
    expect(readStoredSession('ios')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('trade_tycoon_session_v2', '{not json');
    expect(readStoredSession('web')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    localStorage.setItem('trade_tycoon_session_v2', JSON.stringify({ roomId: 'ABCD1234' }));
    expect(readStoredSession('web')).toBeNull();
  });

  it('ignores a pre-token (v1) session shape', () => {
    // The old wire format stored { roomId, userId } with no credential.
    localStorage.setItem(
      'trade_tycoon_session_v2',
      JSON.stringify({ roomId: 'ABCD1234', userId: 'p1' })
    );
    expect(readStoredSession('web')).toBeNull();
  });
});
