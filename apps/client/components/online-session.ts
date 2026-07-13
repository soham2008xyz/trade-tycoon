import { Platform } from 'react-native';

export interface StoredSession {
  roomId: string;
  playerId: string;
  token: string;
}

const SESSION_STORAGE_KEY = 'trade_tycoon_session_v2';

/**
 * Read the saved session from localStorage. Returns null on web platforms
 * without a session, on native (no localStorage), or if the stored value is
 * malformed. Sessions from the pre-token wire format (key
 * `trade_tycoon_session`) are intentionally not migrated — they only carried
 * a public id with no credential, so there is nothing safe to resume from
 * them; the user just re-joins.
 */
export const readStoredSession = (): StoredSession | null => {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      !parsed ||
      typeof parsed.roomId !== 'string' ||
      typeof parsed.playerId !== 'string' ||
      typeof parsed.token !== 'string'
    ) {
      return null;
    }
    return { roomId: parsed.roomId, playerId: parsed.playerId, token: parsed.token };
  } catch {
    return null;
  }
};

export const writeStoredSession = (session: StoredSession): void => {
  if (Platform.OS !== 'web') return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  if (Platform.OS !== 'web') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
};
