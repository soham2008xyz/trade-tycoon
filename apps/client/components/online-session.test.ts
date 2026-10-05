import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  readStoredSession,
  writeStoredSession,
  clearStoredSession,
  type SessionStorage,
} from './online-session';

/**
 * The test environment is Node (no DOM, no native modules); the storage is
 * injected, so these tests pass an in-memory one. The sync variant stands in
 * for web `localStorage`, the async one for native `expo-secure-store`.
 */
const makeMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  } satisfies SessionStorage;
};

const makeAsyncMemoryStorage = (): SessionStorage => {
  const sync = makeMemoryStorage();
  return {
    getItem: async (key) => sync.getItem(key),
    setItem: async (key, value) => {
      sync.setItem(key, value);
    },
    removeItem: async (key) => {
      sync.removeItem(key);
    },
  };
};

const session = { roomId: 'ABCD1234', playerId: 'p1', token: 'secret-token' };

describe('online-session', () => {
  let storage: ReturnType<typeof makeMemoryStorage>;

  beforeEach(() => {
    storage = makeMemoryStorage();
  });

  it('returns null when nothing is stored', async () => {
    expect(await readStoredSession(storage)).toBeNull();
  });

  it('round-trips a written session', async () => {
    await writeStoredSession(storage, session);
    expect(await readStoredSession(storage)).toEqual(session);
  });

  it('clears the stored session', async () => {
    await writeStoredSession(storage, session);
    await clearStoredSession(storage);
    expect(await readStoredSession(storage)).toBeNull();
  });

  it('works with async storage (native)', async () => {
    const asyncStorage = makeAsyncMemoryStorage();
    await writeStoredSession(asyncStorage, session);
    expect(await readStoredSession(asyncStorage)).toEqual(session);
    await clearStoredSession(asyncStorage);
    expect(await readStoredSession(asyncStorage)).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    storage.setItem('trade_tycoon_session_v2', '{not json');
    expect(await readStoredSession(storage)).toBeNull();
  });

  it('returns null when a required field is missing', async () => {
    storage.setItem('trade_tycoon_session_v2', JSON.stringify({ roomId: 'ABCD1234' }));
    expect(await readStoredSession(storage)).toBeNull();
  });

  it('ignores a pre-token (v1) session shape', async () => {
    // The old wire format stored { roomId, userId } with no credential.
    storage.setItem(
      'trade_tycoon_session_v2',
      JSON.stringify({ roomId: 'ABCD1234', userId: 'p1' })
    );
    expect(await readStoredSession(storage)).toBeNull();
  });

  it('swallows storage failures instead of rejecting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fail = () => Promise.reject(new Error('keystore unavailable'));
    const broken: SessionStorage = { getItem: fail, setItem: fail, removeItem: fail };

    expect(await readStoredSession(broken)).toBeNull();
    await expect(writeStoredSession(broken, session)).resolves.toBeUndefined();
    await expect(clearStoredSession(broken)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
