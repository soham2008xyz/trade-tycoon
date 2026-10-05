import { describe, expect, it } from 'vitest';
import { parseStoredSession, serializeStoredSession } from './online-session';

/**
 * The storage calls live in `session-storage.tsx` (react-native / expo), so
 * the node test environment covers the pure encode/decode here.
 */
const session = { roomId: 'ABCD1234', playerId: 'p1', token: 'secret-token' };

describe('online-session', () => {
  it('returns null when nothing is stored', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('')).toBeNull();
  });

  it('round-trips a serialized session', () => {
    expect(parseStoredSession(serializeStoredSession(session))).toEqual(session);
  });

  it('keeps only the known fields', () => {
    const raw = JSON.stringify({ ...session, extra: 'x' });
    expect(parseStoredSession(raw)).toEqual(session);
  });

  it('returns null for malformed JSON', () => {
    expect(parseStoredSession('{not json')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    expect(parseStoredSession('null')).toBeNull();
    expect(parseStoredSession('42')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(parseStoredSession(JSON.stringify({ roomId: 'ABCD1234' }))).toBeNull();
  });

  it('ignores a pre-token (v1) session shape', () => {
    // The old wire format stored { roomId, userId } with no credential.
    expect(parseStoredSession(JSON.stringify({ roomId: 'ABCD1234', userId: 'p1' }))).toBeNull();
  });
});
