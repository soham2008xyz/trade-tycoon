import { GameState } from './types';

/**
 * Shared lobby/room data shapes. Used by both the server (`RoomManager`,
 * REST endpoints) and the client (`OnlineGame`). Keeps the wire format
 * type-safe across the workspace.
 *
 * The file is named `socket-types.ts` for historical reasons — it used to
 * also export Socket.IO event signatures, but those went away when the
 * server moved to REST + SSE.
 */
export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
}

export interface LobbyState {
  roomId: string;
  players: LobbyPlayer[];
  status: 'lobby' | 'game';
  gameState?: GameState;
}
