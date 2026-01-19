import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('Room Creation & Joining', () => {
    it('should create a room and return a valid room ID', () => {
      const roomId = roomManager.createRoom('HostPlayer');
      expect(roomId).toHaveLength(8);

      const room = roomManager.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].name).toBe('HostPlayer');
      expect(room?.players[0].isHost).toBe(true);
    });

    it('should allow another player to join', () => {
      const roomId = roomManager.createRoom('HostPlayer');
      const result = roomManager.joinRoom(roomId, 'Player2');

      expect(result).not.toBeNull();
      expect(result?.userId).toBeDefined();
      expect(result?.state.players).toHaveLength(2);
      expect(result?.state.players[1].name).toBe('Player2');
    });

    it('should not allow joining a non-existent room', () => {
      const result = roomManager.joinRoom('INVALID', 'Player2');
      expect(result).toBeNull();
    });

    it('should not allow joining a full room (8 players)', () => {
      const roomId = roomManager.createRoom('Host');
      // Fill room with 7 more players (total 8)
      for (let i = 1; i < 8; i++) {
        roomManager.joinRoom(roomId, `Player${i}`);
      }

      // 9th player
      const result = roomManager.joinRoom(roomId, 'Player9');
      expect(result).toBeNull();

      const room = roomManager.getRoom(roomId);
      expect(room?.players).toHaveLength(8);
    });

    it('should not allow joining a started game', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;

      // Need 2 players to start
      roomManager.joinRoom(roomId, 'P2');
      roomManager.startGame(roomId, hostId);

      const result = roomManager.joinRoom(roomId, 'LateJoiner');
      expect(result).toBeNull();
    });
  });

  describe('Player Updates', () => {
    it('should update player details', () => {
      const roomId = roomManager.createRoom('Host');
      const room = roomManager.getRoom(roomId)!;
      const hostId = room.players[0].id;

      const updatedState = roomManager.updatePlayer(roomId, hostId, 'NewName', '#000000');
      expect(updatedState).not.toBeNull();

      const updatedPlayer = updatedState!.players.find((p) => p.id === hostId);
      expect(updatedPlayer?.name).toBe('NewName');
      expect(updatedPlayer?.color).toBe('#000000');
    });

    it('should return null when updating player in non-existent room', () => {
      const result = roomManager.updatePlayer('INVALID', 'someId', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should return null when updating non-existent player', () => {
      const roomId = roomManager.createRoom('Host');
      const result = roomManager.updatePlayer(roomId, 'InvalidID', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should prevent updating color if already taken', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      const p2Result = roomManager.joinRoom(roomId, 'P2')!;
      const p2Id = p2Result.userId;

      // Host takes Black
      roomManager.updatePlayer(roomId, hostId, 'Host', '#000000');

      // P2 tries to take Black
      roomManager.updatePlayer(roomId, p2Id, 'P2', '#000000');
      const p2 = roomManager.getRoom(roomId)!.players.find((p) => p.id === p2Id)!;

      expect(p2.color).not.toBe('#000000'); // Should remain original color
    });
  });

  describe('Reconnection', () => {
    it('should handle reconnection for existing lobby player', () => {
      const roomId = roomManager.createRoom('Host');
      const room = roomManager.getRoom(roomId)!;
      const hostId = room.players[0].id;

      const reconnectResult = roomManager.reconnect(roomId, hostId);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.state.roomId).toBe(roomId);
    });

    it('should handle reconnection for existing game player', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      roomManager.joinRoom(roomId, 'P2');
      roomManager.startGame(roomId, hostId);

      const reconnectResult = roomManager.reconnect(roomId, hostId);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.gameState).toBeDefined();
    });

    it('should return null for invalid room or user on reconnect', () => {
      expect(roomManager.reconnect('INVALID', 'uid')).toBeNull();

      const roomId = roomManager.createRoom('Host');
      expect(roomManager.reconnect(roomId, 'INVALID_USER')).toBeNull();
    });
  });

  describe('Game Lifecycle', () => {
    it('should start game only by host and with enough players', () => {
      const roomId = roomManager.createRoom('Host');
      const room = roomManager.getRoom(roomId)!;
      const hostId = room.players[0].id;

      // Try starting with 1 player
      let gameState = roomManager.startGame(roomId, hostId);
      expect(gameState).toBeNull();

      // Add second player
      const p2Result = roomManager.joinRoom(roomId, 'P2');

      // Try starting by non-host
      gameState = roomManager.startGame(roomId, p2Result!.userId);
      expect(gameState).toBeNull();

      // Start by host
      gameState = roomManager.startGame(roomId, hostId);
      expect(gameState).not.toBeNull();
      expect(gameState?.players).toHaveLength(2);
      expect(roomManager.getRoom(roomId)?.status).toBe('game');
    });

    it('should not start game in non-existent room', () => {
      expect(roomManager.startGame('INVALID', 'uid')).toBeNull();
    });
  });

  describe('Game Action Handling', () => {
    it('should handle game action in a started game', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      roomManager.joinRoom(roomId, 'P2');
      roomManager.startGame(roomId, hostId);

      // Assuming ROLL_DICE is a valid action for the current player
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = roomManager.handleGameAction(roomId, hostId, action);

      expect(newState).not.toBeNull();
      expect(newState?.dice).toBeDefined();
    });

    it('should return null for action in non-existent room', () => {
      const action: any = { type: 'ROLL_DICE', playerId: 'uid' };
      expect(roomManager.handleGameAction('INVALID', 'uid', action)).toBeNull();
    });

    it('should return null for action when game not started', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      // Game not started yet (lobby status)
      expect(roomManager.handleGameAction(roomId, hostId, action)).toBeNull();
    });

    it('should return null when user tries to act as another player', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      const p2Result = roomManager.joinRoom(roomId, 'P2')!;
      const p2Id = p2Result.userId;
      roomManager.startGame(roomId, hostId);

      // P2 tries to roll for Host
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = roomManager.handleGameAction(roomId, p2Id, action);

      expect(newState).toBeNull();
    });

    it('should return null when user not in game tries to act', () => {
      const roomId = roomManager.createRoom('Host');
      const hostId = roomManager.getRoom(roomId)!.players[0].id;
      roomManager.joinRoom(roomId, 'P2');
      roomManager.startGame(roomId, hostId);

      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = roomManager.handleGameAction(roomId, 'ALIEN_USER', action);

      expect(newState).toBeNull();
    });
  });
});
