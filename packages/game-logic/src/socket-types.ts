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
  /**
   * Maps a private session token to the public player id it authenticates.
   * Lives inside `LobbyState` so it rides the store's existing CAS atomicity
   * and TTL. Server-internal only — every response/broadcast must go through
   * `toPublicLobbyState` (apps/server/src/serialize.ts) to strip it before it
   * reaches a client.
   */
  sessions?: Record<string, string>;
  /**
   * Incremented on every successful write (see `RoomManager`'s bumpedUpdate
   * helper). Lets a client that's polling instead of using SSE (no
   * `EventSource` on native) tell "nothing changed" from "new state" without
   * deep-comparing the whole room, so it can skip a redundant re-render and
   * back off its poll interval when idle.
   */
  version?: number;
}
