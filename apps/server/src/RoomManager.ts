import {
  ACTION_REJECTED,
  GameState,
  LobbyPlayer,
  LobbyState,
  createInitialState,
  reduceGameAction,
  removePlayerFromGame,
  GameAction,
  createPlayer,
  mulberry32,
} from '@trade-tycoon/game-logic';
import { randomBytes, randomInt } from 'crypto';
import type { RoomStore } from './store/RoomStore';
import { toPublicGameState, toPublicLobbyState } from './serialize';

const MAX_ROOM_ID_RETRIES = 10;
const MAX_PLAYERS_PER_ROOM = 8;
const MAX_PLAYER_NAME_LENGTH = 15;

export interface CreateRoomResult {
  roomId: string;
  playerId: string;
  token: string;
}

export interface JoinRoomResult {
  playerId: string;
  token: string;
  state: LobbyState;
}

export type GameActionResult = { ok: true; state: GameState } | { ok: false; message: string };

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
 *
 * Auth model: each player is identified publicly by `playerId` (broadcast to
 * every client in room/game state) and privately by a `token` (returned only
 * to that player, over the response body of create/join). `token` is the
 * actual credential — every mutating call resolves `playerId` from the
 * caller's `token` via the room's `sessions` map, so knowing another player's
 * public id (which every client can see) confers no ability to act as them.
 */
export class RoomManager {
  constructor(private readonly store: RoomStore) {}

  async createRoom(hostName: string): Promise<CreateRoomResult> {
    const hostId = this.generateUserId();
    const token = this.generateToken();
    const hostPlayer: LobbyPlayer = {
      id: hostId,
      name: hostName.trim().slice(0, MAX_PLAYER_NAME_LENGTH),
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
        sessions: { [token]: hostId },
      });
      if (created) {
        console.log(`[RoomManager] Creating room ${roomId} for host ${hostName} (${hostId})`);
        return { roomId, playerId: hostId, token };
      }
    }
    throw new Error('Could not allocate a unique room id after multiple attempts');
  }

  async joinRoom(roomId: string, playerName: string): Promise<JoinRoomResult | null> {
    roomId = roomId.trim().toUpperCase();

    // The id/token are generated once outside the mutator so that even if the
    // store's retry-on-conflict logic runs the closure twice we hand back a
    // stable pair.
    const userId = this.generateUserId();
    const token = this.generateToken();

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
        name: playerName.trim().slice(0, MAX_PLAYER_NAME_LENGTH),
        color: this.getRandomColor(current.players.map((p) => p.color)),
        isHost: current.players.length === 0,
        isReady: true,
      };
      return {
        ...current,
        players: [...current.players, newPlayer],
        sessions: { ...current.sessions, [token]: userId },
      };
    });

    if (!state) {
      const exists = await this.store.get(roomId);
      if (!exists) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} not found`);
      }
      return null;
    }

    console.log(`[RoomManager] Player ${playerName} (${userId}) joined room ${roomId}`);
    return { playerId: userId, token, state: toPublicLobbyState(state) };
  }

  /** Resolves a private session token to the public player id it authenticates. */
  private resolvePlayerId(current: LobbyState, token: string): string | null {
    return current.sessions?.[token] ?? null;
  }

  async leaveRoom(
    roomId: string,
    token: string
  ): Promise<{ state: LobbyState; gameState: GameState | null } | null> {
    roomId = roomId.trim().toUpperCase();

    const updated = await this.store.update(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      if (!userId) return null;
      const player = current.players.find((entry) => entry.id === userId);
      if (!player) return null;

      const remainingSessions = Object.fromEntries(
        Object.entries(current.sessions ?? {}).filter(([, id]) => id !== userId)
      );

      const remainingPlayers = current.players.filter((entry) => entry.id !== userId);
      const reassignedPlayers = remainingPlayers.map((entry, index) => ({
        ...entry,
        isHost: remainingPlayers.some((candidate) => candidate.isHost) ? entry.isHost : index === 0,
      }));

      if (reassignedPlayers.length === 0) {
        return {
          ...current,
          players: [],
          status: 'lobby' as const,
          gameState: undefined,
          sessions: remainingSessions,
        };
      }

      if (!current.gameState) {
        return {
          ...current,
          players: reassignedPlayers,
          sessions: remainingSessions,
        };
      }

      const nextGameState = removePlayerFromGame(current.gameState, userId);

      if (nextGameState.players.length === 0) {
        return {
          ...current,
          players: reassignedPlayers,
          status: 'lobby' as const,
          gameState: undefined,
          sessions: remainingSessions,
        };
      }

      return {
        ...current,
        players: reassignedPlayers,
        gameState: nextGameState,
        sessions: remainingSessions,
      };
    });

    if (!updated) return null;

    return {
      state: toPublicLobbyState(updated),
      gameState: updated.gameState ? toPublicGameState(updated.gameState) : null,
    };
  }

  // Handle re-connection
  async reconnect(
    roomId: string,
    token: string
  ): Promise<{ state: LobbyState; gameState?: GameState } | null> {
    roomId = roomId.trim().toUpperCase();
    const room = await this.store.get(roomId);
    if (!room) return null;

    const userId = this.resolvePlayerId(room, token);
    if (!userId) return null;

    // Check if player exists in lobby
    const playerInLobby = room.players.find((p) => p.id === userId);

    // Check if player exists in running game
    const playerInGame = room.gameState?.players.find((p) => p.id === userId);

    if (!playerInLobby && !playerInGame) return null;

    return {
      state: toPublicLobbyState(room),
      gameState: room.gameState ? toPublicGameState(room.gameState) : undefined,
    };
  }

  async updatePlayer(
    roomId: string,
    token: string,
    name: string,
    color: string
  ): Promise<LobbyState | null> {
    roomId = roomId.trim().toUpperCase();

    const updated = await this.store.update(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      if (!userId) return null;
      const player = current.players.find((p) => p.id === userId);
      if (!player) return null;

      // Basic validation: name length, unique color
      // If color is taken by someone else, ignore change (or pick random)
      const isColorTaken = current.players.some((p) => p.id !== userId && p.color === color);

      const updatedPlayers = current.players.map((p) =>
        p.id === userId
          ? {
              ...p,
              name: name.substring(0, MAX_PLAYER_NAME_LENGTH),
              color: isColorTaken ? p.color : color,
            }
          : p
      );
      return { ...current, players: updatedPlayers };
    });

    return updated ? toPublicLobbyState(updated) : null;
  }

  async startGame(roomId: string, token: string): Promise<GameState | null> {
    roomId = roomId.trim().toUpperCase();

    const updated = await this.store.update(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      const player = userId ? current.players.find((p) => p.id === userId) : undefined;
      if (!player || !player.isHost) {
        console.warn(`[RoomManager] Start failed: caller is not host or not in room ${roomId}`);
        return null;
      }
      if (current.players.length < 2) {
        console.warn(`[RoomManager] Start failed: Not enough players in room ${roomId}`);
        return null;
      }

      console.log(
        `[RoomManager] Starting game in room ${roomId} with ${current.players.length} players`
      );

      const gameState = createInitialState();
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

    return updated.gameState ? toPublicGameState(updated.gameState) : null;
  }

  async handleGameAction(
    roomId: string,
    token: string,
    action: GameAction
  ): Promise<GameActionResult> {
    roomId = roomId.trim().toUpperCase();

    // Security Check: RESET_GAME has no playerId field — clients must NEVER be
    // able to send it (it would let any player wipe the game). Only the server
    // may dispatch it.
    if (action.type === 'RESET_GAME') {
      console.warn(`[RoomManager] Rejected client-issued RESET_GAME`);
      return { ok: false, message: 'Action rejected' };
    }

    // Sanitize untrusted action input. The reducer accepts client-provided dice
    // (die1/die2) to support deterministic tests, but on a server those values
    // would let a malicious client pick favorable rolls. Force server-side RNG.
    const safeAction =
      action.type === 'ROLL_DICE'
        ? ({ ...action, die1: undefined, die2: undefined } as GameAction)
        : action;

    // Generated once outside the mutator: if a Redis CAS conflict re-invokes
    // the mutator, a fresh mulberry32(seed) instance replays the exact same
    // dice roll / card draw instead of silently re-rolling on retry.
    const seed = this.generateRngSeed();

    // Captured from inside the mutator so the caller learns *why* a rejected
    // action was rejected. Safe to reassign across CAS retries: only the
    // outcome of the most recent (successful-or-aborted) mutator invocation
    // matters, and an aborted mutator never triggers a retry.
    let rejectionMessage = 'Action rejected';

    const updated = await this.store.update(roomId, (current) => {
      if (!current.gameState) {
        rejectionMessage = 'Game has not started';
        return null;
      }

      const userId = this.resolvePlayerId(current, token);
      if (!userId) {
        console.warn(`[RoomManager] Unknown/expired session token for room ${roomId}`);
        return null;
      }

      // Check if user is in the game
      const player = current.gameState.players.find((p) => p.id === userId);
      if (!player) {
        console.warn(`[RoomManager] User ${userId} not in game ${roomId}`);
        return null;
      }

      // The action's playerId must match the token-authenticated user.
      if ('playerId' in safeAction && (safeAction as { playerId: string }).playerId !== userId) {
        console.warn(
          `[RoomManager] User ${userId} tried to act as ${(safeAction as { playerId: string }).playerId}`
        );
        return null;
      }

      const newState = reduceGameAction(current.gameState, safeAction, mulberry32(seed));
      if (newState === ACTION_REJECTED) {
        console.warn(`[RoomManager] Rejected ${safeAction.type} from ${userId}`);
        return null;
      }

      // A soft rejection (e.g. "insufficient funds") carries a player-facing
      // errorMessage but is otherwise the same state. Broadcasting it would
      // leak that private feedback to every player in the room (M9) and
      // amplify a no-op into a full-state fan-out (M5) — abort instead and
      // report it back to only the caller via the HTTP response.
      if (newState.errorMessage) {
        rejectionMessage = newState.errorMessage;
        return null;
      }

      // Pure no-op guard clauses (e.g. acting out of turn) return the exact
      // same state reference — nothing changed, so there's nothing to persist
      // or broadcast.
      if (newState === current.gameState) {
        return null;
      }

      return { ...current, gameState: newState };
    });

    if (!updated?.gameState) {
      return { ok: false, message: rejectionMessage };
    }
    return { ok: true, state: toPublicGameState(updated.gameState) };
  }

  async getRoom(roomId: string): Promise<LobbyState | null> {
    const room = await this.store.get(roomId.trim().toUpperCase());
    return room ? toPublicLobbyState(room) : null;
  }

  /**
   * Resolves a session token to its public player id, for callers (the SSE
   * route) that need to authenticate a request without going through one of
   * the state-mutating methods above.
   */
  async authenticate(
    roomId: string,
    token: string
  ): Promise<{ playerId: string; room: LobbyState } | null> {
    const room = await this.store.get(roomId.trim().toUpperCase());
    if (!room) return null;
    const playerId = this.resolvePlayerId(room, token);
    if (!playerId) return null;
    return { playerId, room: toPublicLobbyState(room) };
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(randomInt(chars.length));
    }
    return result;
  }

  private generateUserId(): string {
    return randomBytes(9).toString('base64url');
  }

  private generateToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /** Extracted as its own method so tests can force a deterministic seed. */
  private generateRngSeed(): number {
    return randomInt(0, 2 ** 31);
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
