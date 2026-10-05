export interface StoredSession {
  roomId: string;
  playerId: string;
  token: string;
}

/**
 * Key-value storage the session lives in. Web passes `localStorage` (sync);
 * native passes an `expo-secure-store` wrapper (async, keychain/keystore,
 * since the token is the credential). Methods may return a value or a
 * Promise — every call below is awaited, so both work.
 *
 * The storage is injected by `session-storage.tsx` instead of imported here —
 * `.ts` modules stay free of react-native / expo imports so the node test
 * environment can load them directly (see AGENTS.md "File-extension
 * discipline"; `online-platform.ts` injects `Platform.OS` the same way).
 */
export interface SessionStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const SESSION_STORAGE_KEY = 'trade_tycoon_session_v2';

/**
 * Read the saved session. Returns null without a session, if the stored value
 * is malformed, or if the storage throws (private browsing; on Android a
 * keystore that can't decrypt data restored from a backup). Sessions from the
 * pre-token wire format (key `trade_tycoon_session`) are intentionally not
 * migrated — they only carried a public id with no credential, so there is
 * nothing safe to resume from them; the user just re-joins.
 */
export const readStoredSession = async (storage: SessionStorage): Promise<StoredSession | null> => {
  try {
    const raw = await storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    // Parsed as `unknown`, not cast straight to `Partial<StoredSession>`: a
    // cast would tell TypeScript the value is always an object, making the
    // `!parsed` guard below look like dead code — but `JSON.parse('null')`
    // and primitives are real possible results here, so the runtime check
    // still matters.
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Partial<StoredSession>).roomId !== 'string' ||
      typeof (parsed as Partial<StoredSession>).playerId !== 'string' ||
      typeof (parsed as Partial<StoredSession>).token !== 'string'
    ) {
      return null;
    }
    const session = parsed as StoredSession;
    return { roomId: session.roomId, playerId: session.playerId, token: session.token };
  } catch {
    return null;
  }
};

export const writeStoredSession = async (
  storage: SessionStorage,
  session: StoredSession
): Promise<void> => {
  try {
    await storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    // Private browsing / storage-disabled environments can throw here
    // (SecurityError, QuotaExceededError). Losing resume is acceptable;
    // crashing the app on write is not.
    console.warn('Failed to save session:', err);
  }
};

export const clearStoredSession = async (storage: SessionStorage): Promise<void> => {
  try {
    await storage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear session:', err);
  }
};
