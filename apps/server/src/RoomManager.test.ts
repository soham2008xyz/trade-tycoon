import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

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

  it('should update player details', () => {
    const roomId = roomManager.createRoom('Host');
    const room = roomManager.getRoom(roomId)!;
    const hostId = room.players[0].id;

    const updatedState = roomManager.updatePlayer(roomId, hostId, 'NewName', '#000000');
    expect(updatedState).not.toBeNull();

    const updatedPlayer = updatedState!.players.find(p => p.id === hostId);
    expect(updatedPlayer?.name).toBe('NewName');
    expect(updatedPlayer?.color).toBe('#000000');
  });

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

  it('should handle reconnection', () => {
      const roomId = roomManager.createRoom('Host');
      const room = roomManager.getRoom(roomId)!;
      const hostId = room.players[0].id;

      const reconnectResult = roomManager.reconnect(roomId, hostId);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.state.roomId).toBe(roomId);
  });
});
