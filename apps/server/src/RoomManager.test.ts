import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager(new InMemoryRoomStore());
  });

  describe('Room Creation & Joining', () => {
    it('should create a room and return a valid room ID', async () => {
      const roomId = await roomManager.createRoom('HostPlayer');
      expect(roomId).toHaveLength(8);

      const room = await roomManager.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].name).toBe('HostPlayer');
      expect(room?.players[0].isHost).toBe(true);
    });

    it('should allow another player to join', async () => {
      const roomId = await roomManager.createRoom('HostPlayer');
      const result = await roomManager.joinRoom(roomId, 'Player2');

      expect(result).not.toBeNull();
      expect(result?.userId).toBeDefined();
      expect(result?.state.players).toHaveLength(2);
      expect(result?.state.players[1].name).toBe('Player2');
    });

    it('should not allow joining a non-existent room', async () => {
      const result = await roomManager.joinRoom('INVALID', 'Player2');
      expect(result).toBeNull();
    });

    it('should not allow joining a full room (8 players)', async () => {
      const roomId = await roomManager.createRoom('Host');
      // Fill room with 7 more players (total 8)
      for (let i = 1; i < 8; i++) {
        await roomManager.joinRoom(roomId, `Player${i}`);
      }

      // 9th player
      const result = await roomManager.joinRoom(roomId, 'Player9');
      expect(result).toBeNull();

      const room = await roomManager.getRoom(roomId);
      expect(room?.players).toHaveLength(8);
    });

    it('should not allow joining a started game', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;

      // Need 2 players to start
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      const result = await roomManager.joinRoom(roomId, 'LateJoiner');
      expect(result).toBeNull();
    });
  });

  describe('Player Updates', () => {
    it('should update player details', async () => {
      const roomId = await roomManager.createRoom('Host');
      const room = (await roomManager.getRoom(roomId))!;
      const hostId = room.players[0].id;

      const updatedState = await roomManager.updatePlayer(roomId, hostId, 'NewName', '#000000');
      expect(updatedState).not.toBeNull();

      const updatedPlayer = updatedState!.players.find((p) => p.id === hostId);
      expect(updatedPlayer?.name).toBe('NewName');
      expect(updatedPlayer?.color).toBe('#000000');
    });

    it('should return null when updating player in non-existent room', async () => {
      const result = await roomManager.updatePlayer('INVALID', 'someId', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should return null when updating non-existent player', async () => {
      const roomId = await roomManager.createRoom('Host');
      const result = await roomManager.updatePlayer(roomId, 'InvalidID', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should prevent updating color if already taken', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      const p2Result = (await roomManager.joinRoom(roomId, 'P2'))!;
      const p2Id = p2Result.userId;

      // Host takes Black
      await roomManager.updatePlayer(roomId, hostId, 'Host', '#000000');

      // P2 tries to take Black
      await roomManager.updatePlayer(roomId, p2Id, 'P2', '#000000');
      const p2 = (await roomManager.getRoom(roomId))!.players.find((p) => p.id === p2Id)!;

      expect(p2.color).not.toBe('#000000'); // Should remain original color
    });
  });

  describe('Reconnection', () => {
    it('should handle reconnection for existing lobby player', async () => {
      const roomId = await roomManager.createRoom('Host');
      const room = (await roomManager.getRoom(roomId))!;
      const hostId = room.players[0].id;

      const reconnectResult = await roomManager.reconnect(roomId, hostId);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.state.roomId).toBe(roomId);
    });

    it('should handle reconnection for existing game player', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      const reconnectResult = await roomManager.reconnect(roomId, hostId);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.gameState).toBeDefined();
    });

    it('should return null for invalid room or user on reconnect', async () => {
      expect(await roomManager.reconnect('INVALID', 'uid')).toBeNull();

      const roomId = await roomManager.createRoom('Host');
      expect(await roomManager.reconnect(roomId, 'INVALID_USER')).toBeNull();
    });
  });

  describe('Game Lifecycle', () => {
    it('should start game only by host and with enough players', async () => {
      const roomId = await roomManager.createRoom('Host');
      const room = (await roomManager.getRoom(roomId))!;
      const hostId = room.players[0].id;

      // Try starting with 1 player
      let gameState = await roomManager.startGame(roomId, hostId);
      expect(gameState).toBeNull();

      // Add second player
      const p2Result = await roomManager.joinRoom(roomId, 'P2');

      // Try starting by non-host
      gameState = await roomManager.startGame(roomId, p2Result!.userId);
      expect(gameState).toBeNull();

      // Start by host
      gameState = await roomManager.startGame(roomId, hostId);
      expect(gameState).not.toBeNull();
      expect(gameState?.players).toHaveLength(2);
      expect((await roomManager.getRoom(roomId))?.status).toBe('game');
    });

    it('should not start game in non-existent room', async () => {
      expect(await roomManager.startGame('INVALID', 'uid')).toBeNull();
    });
  });

  describe('Game Action Handling', () => {
    it('should handle game action in a started game', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      // Assuming ROLL_DICE is a valid action for the current player
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, hostId, action);

      expect(newState).not.toBeNull();
      expect(newState?.dice).toBeDefined();
    });

    it('should return null for action in non-existent room', async () => {
      const action: any = { type: 'ROLL_DICE', playerId: 'uid' };
      expect(await roomManager.handleGameAction('INVALID', 'uid', action)).toBeNull();
    });

    it('should return null for action when game not started', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      // Game not started yet (lobby status)
      expect(await roomManager.handleGameAction(roomId, hostId, action)).toBeNull();
    });

    it('should return null when user tries to act as another player', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      const p2Result = (await roomManager.joinRoom(roomId, 'P2'))!;
      const p2Id = p2Result.userId;
      await roomManager.startGame(roomId, hostId);

      // P2 tries to roll for Host
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, p2Id, action);

      expect(newState).toBeNull();
    });

    it('should return null when user not in game tries to act', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, 'ALIEN_USER', action);

      expect(newState).toBeNull();
    });

    it('should return null when a non-target tries to accept a trade', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      const p2Id = (await roomManager.joinRoom(roomId, 'P2'))!.userId;
      const p3Id = (await roomManager.joinRoom(roomId, 'P3'))!.userId;
      await roomManager.startGame(roomId, hostId);

      await roomManager.handleGameAction(roomId, hostId, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2Id,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      const result = await roomManager.handleGameAction(roomId, p3Id, {
        type: 'ACCEPT_TRADE',
        playerId: p3Id,
      });

      expect(result).toBeNull();
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('should return null when a non-initiator tries to cancel a trade', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      const p2Id = (await roomManager.joinRoom(roomId, 'P2'))!.userId;
      await roomManager.startGame(roomId, hostId);

      await roomManager.handleGameAction(roomId, hostId, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2Id,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      const result = await roomManager.handleGameAction(roomId, p2Id, {
        type: 'CANCEL_TRADE',
        playerId: p2Id,
      });

      expect(result).toBeNull();
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('should reject client-issued RESET_GAME', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      // Even the host cannot reset via the action channel.
      const action: any = {
        type: 'RESET_GAME',
        players: [{ id: 'x', name: 'X', color: '#000' }],
      };
      const result = await roomManager.handleGameAction(roomId, hostId, action);
      expect(result).toBeNull();

      // Game state untouched — original players still present.
      const room = (await roomManager.getRoom(roomId))!;
      expect(room.gameState!.players).toHaveLength(2);
    });

    it('should ignore client-supplied dice values on ROLL_DICE', async () => {
      const roomId = await roomManager.createRoom('Host');
      const hostId = (await roomManager.getRoom(roomId))!.players[0].id;
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostId);

      // Try to cheat with a custom (out-of-range, doubles) roll.
      const cheatAction: any = {
        type: 'ROLL_DICE',
        playerId: hostId,
        die1: 6,
        die2: 6, // would always net doubles + 12 if honored
      };

      // Force the RNG so we can assert the dice came from the server, not the client.
      const rngSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // both dice -> 1
      const newState = await roomManager.handleGameAction(roomId, hostId, cheatAction);
      rngSpy.mockRestore();

      expect(newState).not.toBeNull();
      expect(newState!.dice).toEqual([1, 1]);
    });
  });
});
