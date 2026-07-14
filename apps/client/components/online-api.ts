import type { GameAction, GameState, LobbyState } from '@trade-tycoon/game-logic';

export interface JoinedRoomResponse {
  roomId: string;
  playerId: string;
  token: string;
  isHost: boolean;
}

export interface ReconnectResponse {
  lobby: LobbyState;
  gameState: GameState | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }
  | { ok: false; status: 0; error: string };

/**
 * Read a JSON error message from a non-OK fetch response, falling back to a
 * sensible default. Server endpoints return { error: '...' }.
 */
const readError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // Body wasn't JSON.
  }
  return fallback;
};

/**
 * Pure network layer for the multiplayer REST API — extracted out of
 * OnlineGame.tsx so it can be unit tested with a mocked `fetch` instead of
 * only being exercised (if at all) through a full component render. Every
 * function takes `serverUrl` explicitly rather than reading a module-level
 * constant, which is what makes that testing possible.
 */
async function postJson<T>(
  url: string,
  body: unknown,
  fallbackError: string
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: await readError(res, fallbackError) };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: 'Network error: could not reach server' };
  }
}

export const createRoom = (
  serverUrl: string,
  playerName: string
): Promise<ApiResult<JoinedRoomResponse>> =>
  postJson(`${serverUrl}/api/rooms`, { playerName }, 'Failed to create room');

export const joinRoom = (
  serverUrl: string,
  roomId: string,
  playerName: string
): Promise<ApiResult<JoinedRoomResponse>> =>
  postJson(
    `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/join`,
    { playerName },
    'Could not join room'
  );

export const startGame = (
  serverUrl: string,
  roomId: string,
  token: string
): Promise<ApiResult<{ ok: true }>> =>
  postJson(
    `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/start`,
    { token },
    'Failed to start game'
  );

export const sendGameAction = (
  serverUrl: string,
  roomId: string,
  token: string,
  action: GameAction
): Promise<ApiResult<{ ok: true }>> =>
  postJson(
    `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/actions`,
    { token, action },
    'Action rejected'
  );

export const reconnectToRoom = (
  serverUrl: string,
  roomId: string,
  token: string
): Promise<ApiResult<ReconnectResponse>> =>
  postJson(
    `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/reconnect`,
    { token },
    'Could not reconnect'
  );

export const leaveRoom = (
  serverUrl: string,
  roomId: string,
  token: string
): Promise<ApiResult<{ ok: true }>> =>
  postJson(
    `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/leave`,
    { token },
    'Could not leave room'
  );
