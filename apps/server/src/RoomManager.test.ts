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
      const { roomId } = await roomManager.createRoom('HostPlayer');
      expect(roomId).toHaveLength(8);

      const room = await roomManager.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].name).toBe('HostPlayer');
      expect(room?.players[0].isHost).toBe(true);
    });

    it('should never leak session tokens from getRoom', async () => {
      const { roomId } = await roomManager.createRoom('HostPlayer');
      const room = await roomManager.getRoom(roomId);
      expect((room as unknown as { sessions?: unknown }).sessions).toBeUndefined();
    });

    it('should allow another player to join', async () => {
      const { roomId } = await roomManager.createRoom('HostPlayer');
      const result = await roomManager.joinRoom(roomId, 'Player2');

      expect(result).not.toBeNull();
      expect(result?.playerId).toBeDefined();
      expect(result?.token).toBeDefined();
      expect(result?.token).not.toBe(result?.playerId);
      expect(result?.state.players).toHaveLength(2);
      expect(result?.state.players[1].name).toBe('Player2');
    });

    it('should not allow joining a non-existent room', async () => {
      const result = await roomManager.joinRoom('INVALID', 'Player2');
      expect(result).toBeNull();
    });

    it('should not allow joining a full room (8 players)', async () => {
      const { roomId } = await roomManager.createRoom('Host');
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
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      // Need 2 players to start
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const result = await roomManager.joinRoom(roomId, 'LateJoiner');
      expect(result).toBeNull();
    });

    it('should truncate an overlong player name', async () => {
      const longName = 'a'.repeat(200);
      const { roomId } = await roomManager.createRoom(longName);
      const room = (await roomManager.getRoom(roomId))!;
      expect(room.players[0].name.length).toBeLessThanOrEqual(15);
    });
  });

  describe('Player Updates', () => {
    it('should update player details', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      const updatedState = await roomManager.updatePlayer(roomId, hostToken, 'NewName', '#000000');
      expect(updatedState).not.toBeNull();

      const updatedPlayer = updatedState!.players.find((p) => p.name === 'NewName');
      expect(updatedPlayer?.name).toBe('NewName');
      expect(updatedPlayer?.color).toBe('#000000');
    });

    it('should return null when updating player in non-existent room', async () => {
      const result = await roomManager.updatePlayer('INVALID', 'someToken', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should return null when updating with an unknown token', async () => {
      const { roomId } = await roomManager.createRoom('Host');
      const result = await roomManager.updatePlayer(roomId, 'InvalidToken', 'Name', '#000');
      expect(result).toBeNull();
    });

    it('should prevent updating color if already taken', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const p2Result = (await roomManager.joinRoom(roomId, 'P2'))!;

      // Host takes Black
      await roomManager.updatePlayer(roomId, hostToken, 'Host', '#000000');

      // P2 tries to take Black
      await roomManager.updatePlayer(roomId, p2Result.token, 'P2', '#000000');
      const p2 = (await roomManager.getRoom(roomId))!.players.find(
        (p) => p.id === p2Result.playerId
      )!;

      expect(p2.color).not.toBe('#000000'); // Should remain original color
    });
  });

  describe('Reconnection', () => {
    it('should handle reconnection for existing lobby player', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      const reconnectResult = await roomManager.reconnect(roomId, hostToken);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.state.roomId).toBe(roomId);
    });

    it('should handle reconnection for existing game player', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const reconnectResult = await roomManager.reconnect(roomId, hostToken);
      expect(reconnectResult).not.toBeNull();
      expect(reconnectResult?.gameState).toBeDefined();
    });

    it('should return null for invalid room or token on reconnect', async () => {
      expect(await roomManager.reconnect('INVALID', 'tok')).toBeNull();

      const { roomId } = await roomManager.createRoom('Host');
      expect(await roomManager.reconnect(roomId, 'INVALID_TOKEN')).toBeNull();
    });
  });

  describe('Leaving Rooms', () => {
    it('should reassign the host when the host leaves the lobby', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const secondPlayer = (await roomManager.joinRoom(roomId, 'Player2'))!;

      const result = await roomManager.leaveRoom(roomId, hostToken);

      expect(result).not.toBeNull();
      expect(result?.state.players).toHaveLength(1);
      expect(result?.state.players[0].id).toBe(secondPlayer.playerId);
      expect(result?.state.players[0].isHost).toBe(true);
    });

    it('should remove a player from the running game and award the win when one remains', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const secondPlayer = (await roomManager.joinRoom(roomId, 'Player2'))!;
      await roomManager.startGame(roomId, hostToken);

      const result = await roomManager.leaveRoom(roomId, secondPlayer.token);

      expect(result).not.toBeNull();
      expect(result?.state.players).toHaveLength(1);
      expect(result?.state.players[0].id).toBe(hostId);
      expect(result?.gameState?.players).toHaveLength(1);
      expect(result?.gameState?.winner).toBe(hostId);
    });

    it('should advance the turn when the current player leaves a three-player game', async () => {
      const {
        roomId,
        playerId: player1Id,
        token: player1Token,
      } = await roomManager.createRoom('Player1');
      const player2 = (await roomManager.joinRoom(roomId, 'Player2'))!;
      const player3 = (await roomManager.joinRoom(roomId, 'Player3'))!;
      await roomManager.startGame(roomId, player1Token);

      await roomManager.handleGameAction(roomId, player1Token, {
        type: 'END_TURN',
        playerId: player1Id,
      });

      const result = await roomManager.leaveRoom(roomId, player2.token);

      expect(result).not.toBeNull();
      expect(result?.gameState?.players.map((player) => player.id)).toEqual([
        player1Id,
        player3.playerId,
      ]);
      expect(result?.gameState?.currentPlayerId).toBe(player3.playerId);
      expect(result?.gameState?.phase).toBe('roll');
    });

    it('should drop the leaving player from the sessions map', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = (await roomManager.joinRoom(roomId, 'P2'))!;

      await roomManager.leaveRoom(roomId, p2.token);

      // The old token must no longer authenticate anything.
      expect(await roomManager.reconnect(roomId, p2.token)).toBeNull();
      // The host's token must still work.
      expect(await roomManager.reconnect(roomId, hostToken)).not.toBeNull();
    });
  });

  describe('Game Lifecycle', () => {
    it('should start game only by host and with enough players', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      // Try starting with 1 player
      let gameState = await roomManager.startGame(roomId, hostToken);
      expect(gameState).toBeNull();

      // Add second player
      const p2Result = await roomManager.joinRoom(roomId, 'P2');

      // Try starting by non-host
      gameState = await roomManager.startGame(roomId, p2Result!.token);
      expect(gameState).toBeNull();

      // Start by host
      gameState = await roomManager.startGame(roomId, hostToken);
      expect(gameState).not.toBeNull();
      expect(gameState?.players).toHaveLength(2);
      expect((await roomManager.getRoom(roomId))?.status).toBe('game');
    });

    it('should not start game in non-existent room', async () => {
      expect(await roomManager.startGame('INVALID', 'tok')).toBeNull();
    });
  });

  describe('Game Action Handling', () => {
    it('should handle game action in a started game', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // Assuming ROLL_DICE is a valid action for the current player
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, hostToken, action);

      expect(newState).not.toBeNull();
      expect(newState?.dice).toBeDefined();
    });

    it('should return null for action in non-existent room', async () => {
      const action: any = { type: 'ROLL_DICE', playerId: 'uid' };
      expect(await roomManager.handleGameAction('INVALID', 'tok', action)).toBeNull();
    });

    it('should return null for action when game not started', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      // Game not started yet (lobby status)
      expect(await roomManager.handleGameAction(roomId, hostToken, action)).toBeNull();
    });

    it('should return null when a token is used to act as another player', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2Result = (await roomManager.joinRoom(roomId, 'P2'))!;
      await roomManager.startGame(roomId, hostToken);

      // P2's token resolves to P2's id, but the action claims to be Host.
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, p2Result.token, action);

      expect(newState).toBeNull();
    });

    it('should return null when an unknown token tries to act', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const newState = await roomManager.handleGameAction(roomId, 'ALIEN_TOKEN', action);

      expect(newState).toBeNull();
    });

    it('should return null when a non-target tries to accept a trade', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = (await roomManager.joinRoom(roomId, 'P2'))!;
      const p3 = (await roomManager.joinRoom(roomId, 'P3'))!;
      await roomManager.startGame(roomId, hostToken);

      await roomManager.handleGameAction(roomId, hostToken, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2.playerId,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      const result = await roomManager.handleGameAction(roomId, p3.token, {
        type: 'ACCEPT_TRADE',
        playerId: p3.playerId,
      });

      expect(result).toBeNull();
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('should return null when a non-initiator tries to cancel a trade', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = (await roomManager.joinRoom(roomId, 'P2'))!;
      await roomManager.startGame(roomId, hostToken);

      await roomManager.handleGameAction(roomId, hostToken, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2.playerId,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      const result = await roomManager.handleGameAction(roomId, p2.token, {
        type: 'CANCEL_TRADE',
        playerId: p2.playerId,
      });

      expect(result).toBeNull();
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('should reject client-issued RESET_GAME', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // Even the host cannot reset via the action channel.
      const action: any = {
        type: 'RESET_GAME',
        players: [{ id: 'x', name: 'X', color: '#000' }],
      };
      const result = await roomManager.handleGameAction(roomId, hostToken, action);
      expect(result).toBeNull();

      // Game state untouched — original players still present.
      const room = (await roomManager.getRoom(roomId))!;
      expect(room.gameState!.players).toHaveLength(2);
    });

    it('should ignore client-supplied dice values on ROLL_DICE', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // Try to cheat with a custom (out-of-range, doubles) roll.
      const cheatAction: any = {
        type: 'ROLL_DICE',
        playerId: hostId,
        die1: 6,
        die2: 6, // would always net doubles + 12 if honored
      };

      // Force the RNG so we can assert the dice came from the server, not the client.
      const rngSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // both dice -> 1
      const newState = await roomManager.handleGameAction(roomId, hostToken, cheatAction);
      rngSpy.mockRestore();

      expect(newState).not.toBeNull();
      expect(newState!.dice).toEqual([1, 1]);
    });

    it('should keep the existing trade pending when another proposal is submitted', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = (await roomManager.joinRoom(roomId, 'P2'))!;
      await roomManager.startGame(roomId, hostToken);

      const firstState = await roomManager.handleGameAction(roomId, hostToken, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2.playerId,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });
      expect(firstState?.activeTrade).toBeTruthy();

      const secondState = await roomManager.handleGameAction(roomId, p2.token, {
        type: 'PROPOSE_TRADE',
        playerId: p2.playerId,
        targetPlayerId: hostId,
        offer: { money: 10, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      expect(secondState?.activeTrade?.id).toBe(firstState?.activeTrade?.id);
      expect(secondState?.errorMessage).toMatch(/resolve the current trade/i);
    });

    it('should strip the nested board from room snapshots after a game starts', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const room = await roomManager.getRoom(roomId);

      expect(room?.gameState).toBeTruthy();
      expect(room?.gameState?.board).toBeUndefined();
    });
  });
});
