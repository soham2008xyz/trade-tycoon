import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  parseStoredSession,
  serializeStoredSession,
  SESSION_STORAGE_KEY,
  type StoredSession,
} from './online-session';

/**
 * Where the online session is kept: `localStorage` on web, the
 * keychain/keystore via `expo-secure-store` on native (the token is the
 * credential), so it survives the app being killed (#258). Lives in a `.tsx`
 * file because it imports react-native and expo (see AGENTS.md
 * "File-extension discipline"); the encode/decode is in `online-session.ts`.
 *
 * All three are async because SecureStore is. Await `clearStoredSession`
 * before leaving the screen, or the menu remounts and reads the session back.
 */
const isWeb = Platform.OS === 'web';

/**
 * Read the saved session. Returns null without one, or if storage throws
 * (private browsing; on Android a keystore that can't decrypt data restored
 * from a backup).
 */
export const readStoredSession = async (): Promise<StoredSession | null> => {
  try {
    const raw = isWeb
      ? localStorage.getItem(SESSION_STORAGE_KEY)
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    return parseStoredSession(raw);
  } catch {
    return null;
  }
};

export const writeStoredSession = async (session: StoredSession): Promise<void> => {
  try {
    const value = serializeStoredSession(session);
    if (isWeb) localStorage.setItem(SESSION_STORAGE_KEY, value);
    else await SecureStore.setItemAsync(SESSION_STORAGE_KEY, value);
  } catch (err) {
    // Private browsing / storage-disabled environments can throw here
    // (SecurityError, QuotaExceededError). Losing resume is acceptable;
    // crashing the app on write is not.
    console.warn('Failed to save session:', err);
  }
};

export const clearStoredSession = async (): Promise<void> => {
  try {
    if (isWeb) localStorage.removeItem(SESSION_STORAGE_KEY);
    else await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear session:', err);
  }
};
