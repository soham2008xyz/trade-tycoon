export interface StoredSession {
  roomId: string;
  playerId: string;
  token: string;
}

/**
 * Storage key for the online session. The storage calls themselves live in
 * `session-storage.tsx` (localStorage on web, `expo-secure-store` on native),
 * because they need react-native and expo imports; this `.ts` module keeps
 * the pure encode/decode so the node test environment can load it (see
 * AGENTS.md "File-extension discipline").
 */
export const SESSION_STORAGE_KEY = 'trade_tycoon_session_v2';

/**
 * Decode a stored session. Returns null for a missing or malformed value.
 * Sessions from the pre-token wire format (key `trade_tycoon_session`) are
 * intentionally not migrated — they only carried a public id with no
 * credential, so there is nothing safe to resume from them; the user just
 * re-joins.
 */
export const parseStoredSession = (raw: string | null): StoredSession | null => {
  if (!raw) return null;
  try {
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

/** Encode a session for storage; only the three known fields are kept. */
export const serializeStoredSession = (session: StoredSession): string =>
  JSON.stringify({ roomId: session.roomId, playerId: session.playerId, token: session.token });
