import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  startGame,
  sendGameAction,
  reconnectToRoom,
  leaveRoom,
} from './online-api';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('online-api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('createRoom posts playerName and returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { roomId: 'ABCD1234', playerId: 'p1', token: 'tok', isHost: true })
    );

    const result = await createRoom('http://server', 'Alice');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://server/api/rooms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ playerName: 'Alice' }),
      })
    );
    expect(result).toEqual({
      ok: true,
      data: { roomId: 'ABCD1234', playerId: 'p1', token: 'tok', isHost: true },
    });
  });

  it('createRoom surfaces the server error message and status on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'playerName is required' }));

    const result = await createRoom('http://server', '');

    expect(result).toEqual({ ok: false, status: 400, error: 'playerName is required' });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    const result = await createRoom('http://server', 'Alice');

    expect(result).toEqual({ ok: false, status: 500, error: 'Failed to create room' });
  });

  it('reports a network error (fetch throwing) as a distinct status-0 result', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await createRoom('http://server', 'Alice');

    expect(result).toEqual({
      ok: false,
      status: 0,
      error: 'Network error: could not reach server',
    });
  });

  it('joinRoom URL-encodes the room id and posts playerName', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { roomId: 'ABCD1234', playerId: 'p2', token: 'tok2', isHost: false })
    );

    await joinRoom('http://server', 'room with space', 'Bob');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://server/api/rooms/room%20with%20space/join',
      expect.objectContaining({ body: JSON.stringify({ playerName: 'Bob' }) })
    );
  });

  it('startGame posts only the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await startGame('http://server', 'ABCD1234', 'tok');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://server/api/rooms/ABCD1234/start',
      expect.objectContaining({ body: JSON.stringify({ token: 'tok' }) })
    );
  });

  it('sendGameAction posts the token and action together', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const action = { type: 'ROLL_DICE' as const, playerId: 'p1' };

    await sendGameAction('http://server', 'ABCD1234', 'tok', action);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://server/api/rooms/ABCD1234/actions',
      expect.objectContaining({ body: JSON.stringify({ token: 'tok', action }) })
    );
  });

  it('reconnectToRoom returns the lobby/gameState body on success', async () => {
    const body = { lobby: { roomId: 'ABCD1234', players: [], status: 'lobby' }, gameState: null };
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    const result = await reconnectToRoom('http://server', 'ABCD1234', 'tok');

    expect(result).toEqual({ ok: true, data: body });
  });

  it('reconnectToRoom surfaces a 404 session_expired distinctly', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'session_expired' }));

    const result = await reconnectToRoom('http://server', 'ABCD1234', 'stale-token');

    expect(result).toEqual({ ok: false, status: 404, error: 'session_expired' });
  });

  it('leaveRoom posts only the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await leaveRoom('http://server', 'ABCD1234', 'tok');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://server/api/rooms/ABCD1234/leave',
      expect.objectContaining({ body: JSON.stringify({ token: 'tok' }) })
    );
  });
});
