import { GameState, GameAction } from './types';

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

export interface ClientToServerEvents {
  create_room: (playerName: string) => void;
  join_room: (roomId: string, playerName: string) => void;
  update_player: (roomId: string, userId: string, name: string, color: string) => void;
  start_game: (roomId: string, userId: string) => void;
  game_action: (roomId: string, userId: string, action: GameAction) => void;
  reconnect: (roomId: string, userId: string) => void;
}

export interface ServerToClientEvents {
  lobby_update: (lobbyState: LobbyState) => void;
  game_state_update: (gameState: GameState) => void;
  error: (message: string) => void;
  joined_room: (payload: { roomId: string; userId: string; isHost: boolean }) => void;
}
