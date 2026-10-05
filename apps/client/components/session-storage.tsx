import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from './online-session';

/**
 * Where `online-session.ts` keeps the online session. Lives in a `.tsx` file
 * because it imports react-native and expo (see AGENTS.md "File-extension
 * discipline"). Web uses `localStorage`; native uses the keychain/keystore
 * via `expo-secure-store` so the session survives the app being killed (#258).
 */
export const onlineSessionStorage: SessionStorage =
  Platform.OS === 'web'
    ? {
        // Wrapped rather than passing `localStorage` itself: accessing the
        // global can throw (storage-disabled browsers), and the throw must
        // happen inside online-session's try/catch, not at import time.
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          localStorage.setItem(key, value);
        },
        removeItem: (key) => {
          localStorage.removeItem(key);
        },
      }
    : {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      };
