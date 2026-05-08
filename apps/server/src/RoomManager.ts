import {
  GameState,
  LobbyPlayer,
  LobbyState,
  createInitialState,
  gameReducer,
  GameAction,
  createPlayer,
} from '@trade-tycoon/game-logic';
import type { RoomStore } from './store/RoomStore';

const MAX_ROOM_ID_RETRIES = 10;
const MAX_PLAYERS_PER_ROOM = 8;

/**
 * Encapsulates all multiplayer business logic: room lifecycle, player joins,
 * starting games, and applying game actions. State persistence is delegated
 * to a `RoomStore` so the same logic runs on top of an in-memory Map (tests
 * + dev) or Upstash Redis (Vercel production).
 *
 * Every public method is async because the production store is over the
 * network. The mutator passed to `store.update` may be retried on a Redis
 * WATCH conflict, so it must remain a pure function of the input state — any
 * side effects (id generation, color assignment) that need to land exactly
 * once must be captured outside the closure.
 */
export class RoomManager {
  constructor(private readonly store: RoomStore) {}

  async createRoom(hostName: string): Promise<string> {
    const hostId = this.generateUserId();
    const hostPlayer: LobbyPlayer = {
      id: hostId,
      name: hostName,
      color: this.getRandomColor(),
      isHost: true,
      isReady: true,
    };

    for (let i = 0; i < MAX_ROOM_ID_RETRIES; i++) {
      const roomId = this.generateRoomId();
      const created = await this.store.create({
        roomId,
        players: [hostPlayer],
        status: 'lobby',
      });
      if (created) {
        console.log(`[RoomManager] Creating room ${roomId} for host ${hostName} (${hostId})`);
        return roomId;
      }
    }
    throw new Error('Could not allocate a unique room id after multiple attempts');
  }

  async joinRoom(
    roomId: string,
    playerName: string
  ): Promise<{ userId: string; state: LobbyState } | null> {
    roomId = roomId.trim().toUpperCase();

    // The user id is generated once outside the mutator so that even if the
    // Redis WATCH retry runs the closure twice we hand back a stable id.
    const userId = this.generateUserId();

    const state = await this.store.update(roomId, (current) => {
      if (current.status !== 'lobby') {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is in progress`);
        return null;
      }
      if (current.players.length >= MAX_PLAYERS_PER_ROOM) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is full`);
        return null;
      }
      const newPlayer: LobbyPlayer = {
        id: userId,
        name: playerName,
        color: this.getRandomColor(current.players.map((p) => p.color)),
        isHost: false,
        isReady: true,
      };
      return { ...current, players: [...current.players, newPlayer] };
    });

    if (!state) {
      const exists = await this.store.get(roomId);
      if (!exists) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} not found`);
      }
      return null;
    }

    console.log(`[RoomManager] Player ${playerName} (${userId}) joined room ${roomId}`);
    return { userId, state };
  }

  // Handle re-connection
  async reconnect(
    roomId: string,
    userId: string
  ): Promise<{ state: LobbyState; gameState?: GameState } | null> {
    roomId = roomId.trim().toUpperCase();
    const room = await this.store.get(roomId);
    if (!room) return null;

    // Check if player exists in lobby
    const playerInLobby = room.players.find((p) => p.id === userId);

    // Check if player exists in running game
    const playerInGame = room.gameState?.players.find((p) => p.id === userId);

    if (!playerInLobby && !playerInGame) return null;

    return {
      state: room,
      gameState: room.gameState ? this.stripBoard(room.gameState) : undefined,
    };
  }

  async updatePlayer(
    roomId: string,
    userId: string,
    name: string,
    color: string
  ): Promise<LobbyState | null> {
    roomId = roomId.trim().toUpperCase();

    return this.store.update(roomId, (current) => {
      const player = current.players.find((p) => p.id === userId);
      if (!player) return null;

      // Basic validation: name length, unique color
      // If color is taken by someone else, ignore change (or pick random)
      const isColorTaken = current.players.some((p) => p.id !== userId && p.color === color);

      const updatedPlayers = current.players.map((p) =>
        p.id === userId
          ? { ...p, name: name.substring(0, 15), color: isColorTaken ? p.color : color }
          : p
      );
      return { ...current, players: updatedPlayers };
    });
  }

  async startGame(roomId: string, userId: string): Promise<GameState | null> {
    roomId = roomId.trim().toUpperCase();

    const updated = await this.store.update(roomId, (current) => {
      const player = current.players.find((p) => p.id === userId);
      if (!player || !player.isHost) {
        console.warn(`[RoomManager] Start failed: User ${userId} is not host or not in room`);
        return null;
      }
      if (current.players.length < 2) {
        console.warn(`[RoomManager] Start failed: Not enough players in room ${roomId}`);
        return null;
      }

      console.log(
        `[RoomManager] Starting game in room ${roomId} with ${current.players.length} players`
      );

      let gameState = createInitialState();
      const gamePlayers = current.players.map((p) => {
        const gp = createPlayer(p.id, p.name);
        gp.color = p.color;
        return gp;
      });
      gameState.players = gamePlayers;
      gameState.currentPlayerId = gamePlayers[0].id;

      return { ...current, status: 'game' as const, gameState };
    });

    if (!updated) {
      const exists = await this.store.get(roomId);
      if (!exists) console.warn(`[RoomManager] Start failed: Room ${roomId} not found`);
      return null;
    }

    return updated.gameState ? this.stripBoard(updated.gameState) : null;
  }

  async handleGameAction(
    roomId: string,
    userId: string,
    action: GameAction
  ): Promise<GameState | null> {
    roomId = roomId.trim().toUpperCase();

    // Security Check: RESET_GAME has no playerId field — clients must NEVER be
    // able to send it (it would let any player wipe the game). Only the server
    // may dispatch it.
    if (action.type === 'RESET_GAME') {
      console.warn(`[RoomManager] Rejected client-issued RESET_GAME from ${userId}`);
      return null;
    }

    // Sanitize untrusted action input. The reducer accepts client-provided dice
    // (die1/die2) to support deterministic tests, but on a server those values
    // would let a malicious client pick favorable rolls. Force server-side RNG.
    const safeAction =
      action.type === 'ROLL_DICE'
        ? ({ ...action, die1: undefined, die2: undefined } as GameAction)
        : action;

    const updated = await this.store.update(roomId, (current) => {
      if (!current.gameState) return null;

      // Check if user is in the game
      const player = current.gameState.players.find((p) => p.id === userId);
      if (!player) {
        console.warn(`[RoomManager] User ${userId} not in game ${roomId}`);
        return null;
      }

      // The action's playerId must match the authenticated user.
      if ('playerId' in safeAction && (safeAction as { playerId: string }).playerId !== userId) {
        console.warn(
          `[RoomManager] User ${userId} tried to act as ${(safeAction as { playerId: string }).playerId}`
        );
        return null;
      }

      const newState = gameReducer(current.gameState, safeAction);
      return { ...current, gameState: newState };
    });

    return updated?.gameState ? this.stripBoard(updated.gameState) : null;
  }

  private stripBoard(state: GameState): GameState {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { board: _board, ...rest } = state as GameState & { board?: unknown };
    return rest as GameState;
  }

  async getRoom(roomId: string): Promise<LobbyState | null> {
    return this.store.get(roomId.trim().toUpperCase());
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateUserId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getRandomColor(excludeColors: string[] = []): string {
    const colors = [
      '#FF0000', // Red
      '#0000FF', // Blue
      '#008000', // Green
      '#FFFF00', // Yellow
      '#FFA500', // Orange
      '#800080', // Purple
      '#00FFFF', // Cyan
      '#FFC0CB', // Pink
    ];
    const available = colors.filter((c) => !excludeColors.includes(c));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // Fallback to random
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }
}
