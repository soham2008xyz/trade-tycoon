export interface StoredSession {
  roomId: string;
  playerId: string;
  token: string;
}

const SESSION_STORAGE_KEY = 'trade_tycoon_session_v2';

/**
 * Session persistence is web-only (localStorage). `platform` is injected by
 * the calling component (pass `Platform.OS`) instead of imported from
 * react-native here — `.ts` modules stay free of react-native imports so the
 * node test environment can load them directly (see AGENTS.md
 * "File-extension discipline"; `online-platform.ts` uses the same pattern).
 */

/**
 * Read the saved session from localStorage. Returns null on web platforms
 * without a session, on native (no localStorage), or if the stored value is
 * malformed. Sessions from the pre-token wire format (key
 * `trade_tycoon_session`) are intentionally not migrated — they only carried
 * a public id with no credential, so there is nothing safe to resume from
 * them; the user just re-joins.
 */
export const readStoredSession = (platform: string): StoredSession | null => {
  if (platform !== 'web') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
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

export const writeStoredSession = (platform: string, session: StoredSession): void => {
  if (platform !== 'web') return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    // Private browsing / storage-disabled environments can throw here
    // (SecurityError, QuotaExceededError). Losing resume-on-refresh is
    // acceptable; crashing the app on write is not.
    console.warn('Failed to write session to localStorage:', err);
  }
};

export const clearStoredSession = (platform: string): void => {
  if (platform !== 'web') return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear session from localStorage:', err);
  }
};
