import {
  GameState,
  LobbyPlayer,
  LobbyState,
  createInitialState,
  gameReducer,
  GameAction,
  createPlayer,
} from '@trade-tycoon/game-logic';

export class RoomManager {
  private rooms: Map<string, LobbyState> = new Map();

  createRoom(hostName: string): string {
    const roomId = this.generateRoomId();
    const hostId = this.generateUserId();
    console.log(`[RoomManager] Creating room ${roomId} for host ${hostName} (${hostId})`);

    const hostPlayer: LobbyPlayer = {
      id: hostId,
      name: hostName,
      color: this.getRandomColor(),
      isHost: true,
      isReady: true,
    };

    const newRoom: LobbyState = {
      roomId,
      players: [hostPlayer],
      status: 'lobby',
    };

    this.rooms.set(roomId, newRoom);
    return roomId;
  }

  joinRoom(roomId: string, playerName: string): { userId: string; state: LobbyState } | null {
    const room = this.rooms.get(roomId);
    if (!room) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} not found`);
        return null;
    }
    if (room.status !== 'lobby') {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is in progress`);
        return null; // Cannot join started game for now
    }
    if (room.players.length >= 8) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is full`);
        return null; // Max players
    }

    const userId = this.generateUserId();
    const newPlayer: LobbyPlayer = {
      id: userId,
      name: playerName,
      color: this.getRandomColor(room.players.map((p) => p.color)),
      isHost: false,
      isReady: true,
    };

    room.players.push(newPlayer);
    console.log(`[RoomManager] Player ${playerName} (${userId}) joined room ${roomId}`);
    return { userId, state: room };
  }

  // Handle re-connection
  reconnect(
    roomId: string,
    userId: string
  ): { state: LobbyState; gameState?: GameState } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Check if player exists in lobby
    const playerInLobby = room.players.find((p) => p.id === userId);

    // Check if player exists in running game
    const playerInGame = room.gameState?.players.find((p) => p.id === userId);

    if (!playerInLobby && !playerInGame) return null;

    return { state: room, gameState: room.gameState };
  }

  updatePlayer(roomId: string, userId: string, name: string, color: string): LobbyState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find((p) => p.id === userId);
    if (!player) return null;

    // Basic validation: name length, unique color
    // If color is taken by someone else, ignore change (or pick random)
    const isColorTaken = room.players.some((p) => p.id !== userId && p.color === color);

    player.name = name.substring(0, 15); // Limit name length
    if (!isColorTaken) {
      player.color = color;
    }

    return room;
  }

  startGame(roomId: string, userId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room) {
         console.warn(`[RoomManager] Start failed: Room ${roomId} not found`);
         return null;
    }

    const player = room.players.find((p) => p.id === userId);
    if (!player || !player.isHost) {
        console.warn(`[RoomManager] Start failed: User ${userId} is not host or not in room`);
        return null; // Only host can start
    }

    if (room.players.length < 2) {
        console.warn(`[RoomManager] Start failed: Not enough players in room ${roomId}`);
        return null; // Min 2 players
    }

    console.log(`[RoomManager] Starting game in room ${roomId} with ${room.players.length} players`);

    // Initialize Game Logic State
    let gameState = createInitialState();

    // Map LobbyPlayers to GamePlayers
    const gamePlayers = room.players.map(p => {
        const gp = createPlayer(p.id, p.name);
        gp.color = p.color;
        return gp;
    });

    gameState.players = gamePlayers;
    gameState.currentPlayerId = gamePlayers[0].id;

    room.status = 'game';
    room.gameState = gameState;

    return gameState;
  }

  handleGameAction(roomId: string, action: GameAction): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) return null;

    // Apply reducer
    const newState = gameReducer(room.gameState, action);
    room.gameState = newState;

    return newState;
  }

  getRoom(roomId: string): LobbyState | undefined {
    return this.rooms.get(roomId);
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness (simple check)
    if (this.rooms.has(result)) return this.generateRoomId();
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
