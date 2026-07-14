import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mulberry32 } from '@trade-tycoon/game-logic';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager(new InMemoryRoomStore());
  });

  /** Unwraps the ok arm of joinRoom so happy-path setup can dot into fields. */
  const join = async (roomId: string, name: string) => {
    const result = await roomManager.joinRoom(roomId, name);
    if (!result.ok) throw new Error(`join failed: ${result.message}`);
    return result;
  };

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

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.playerId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token).not.toBe(result.playerId);
      expect(result.state.players).toHaveLength(2);
      expect(result.state.players[1].name).toBe('Player2');
    });

    it('should not allow joining a non-existent room', async () => {
      const result = await roomManager.joinRoom('INVALID', 'Player2');
      expect(result).toEqual({ ok: false, reason: 'not_found', message: expect.any(String) });
    });

    it('should not allow joining a full room (8 players)', async () => {
      const { roomId } = await roomManager.createRoom('Host');
      // Fill room with 7 more players (total 8)
      for (let i = 1; i < 8; i++) {
        await roomManager.joinRoom(roomId, `Player${i}`);
      }

      // 9th player
      const result = await roomManager.joinRoom(roomId, 'Player9');
      expect(result).toEqual({ ok: false, reason: 'conflict', message: 'Room is full' });

      const room = await roomManager.getRoom(roomId);
      expect(room?.players).toHaveLength(8);
    });

    it('should not allow joining a started game', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      // Need 2 players to start
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const result = await roomManager.joinRoom(roomId, 'LateJoiner');
      expect(result).toEqual({
        ok: false,
        reason: 'conflict',
        message: 'Room is already in progress',
      });
    });

    it('should increment version on every successful write', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const v1 = (await roomManager.getRoom(roomId))!.version;

      await roomManager.joinRoom(roomId, 'P2');
      const v2 = (await roomManager.getRoom(roomId))!.version;
      expect(v2).toBeGreaterThan(v1!);

      await roomManager.updatePlayer(roomId, hostToken, 'Host', '#000000');
      const v3 = (await roomManager.getRoom(roomId))!.version;
      expect(v3).toBeGreaterThan(v2!);
    });

    it('should not bump version when an update is rejected', async () => {
      const { roomId } = await roomManager.createRoom('Host');
      const before = (await roomManager.getRoom(roomId))!.version;

      // Joining a full room is a no-op rejection, not a write.
      for (let i = 1; i < 8; i++) {
        await roomManager.joinRoom(roomId, `Player${i}`);
      }
      const afterFilling = (await roomManager.getRoom(roomId))!.version;

      const rejected = await roomManager.joinRoom(roomId, 'Player9');
      expect(rejected.ok).toBe(false);
      expect((await roomManager.getRoom(roomId))!.version).toBe(afterFilling);
      expect(afterFilling).toBeGreaterThan(before!);
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

      const result = await roomManager.updatePlayer(roomId, hostToken, 'NewName', '#000000');
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');

      const updatedPlayer = result.state.players.find((p) => p.name === 'NewName');
      expect(updatedPlayer?.name).toBe('NewName');
      expect(updatedPlayer?.color).toBe('#000000');
    });

    it('should report not_found when updating player in non-existent room', async () => {
      const result = await roomManager.updatePlayer('INVALID', 'someToken', 'Name', '#000');
      expect(result).toEqual({ ok: false, reason: 'not_found', message: expect.any(String) });
    });

    it('should report unauthorized when updating with an unknown token', async () => {
      const { roomId } = await roomManager.createRoom('Host');
      const result = await roomManager.updatePlayer(roomId, 'InvalidToken', 'Name', '#000');
      expect(result).toEqual({ ok: false, reason: 'unauthorized', message: expect.any(String) });
    });

    it('should prevent updating color if already taken', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const p2Result = await join(roomId, 'P2');

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

      const result = await roomManager.reconnect(roomId, hostToken);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.roomId).toBe(roomId);
    });

    it('should handle reconnection for existing game player', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const result = await roomManager.reconnect(roomId, hostToken);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.gameState).toBeDefined();
    });

    it('should report session_expired for invalid room or token on reconnect', async () => {
      // Both failure modes collapse to the same 404 session_expired shape the
      // client resume flow depends on — deliberately not a 401.
      const expired = { ok: false, reason: 'not_found', message: 'session_expired' };
      expect(await roomManager.reconnect('INVALID', 'tok')).toEqual(expired);

      const { roomId } = await roomManager.createRoom('Host');
      expect(await roomManager.reconnect(roomId, 'INVALID_TOKEN')).toEqual(expired);
    });
  });

  describe('Leaving Rooms', () => {
    it('should reassign the host when the host leaves the lobby', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const secondPlayer = await join(roomId, 'Player2');

      const result = await roomManager.leaveRoom(roomId, hostToken);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.players).toHaveLength(1);
      expect(result.state.players[0].id).toBe(secondPlayer.playerId);
      expect(result.state.players[0].isHost).toBe(true);
    });

    it('should remove a player from the running game and award the win when one remains', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const secondPlayer = await join(roomId, 'Player2');
      await roomManager.startGame(roomId, hostToken);

      const result = await roomManager.leaveRoom(roomId, secondPlayer.token);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.players).toHaveLength(1);
      expect(result.state.players[0].id).toBe(hostId);
      expect(result.gameState?.players).toHaveLength(1);
      expect(result.gameState?.winner).toBe(hostId);
    });

    it('should advance the turn when the current player leaves a three-player game', async () => {
      const {
        roomId,
        playerId: player1Id,
        token: player1Token,
      } = await roomManager.createRoom('Player1');
      const player2 = await join(roomId, 'Player2');
      const player3 = await join(roomId, 'Player3');
      await roomManager.startGame(roomId, player1Token);

      await roomManager.handleGameAction(roomId, player1Token, {
        type: 'END_TURN',
        playerId: player1Id,
      });

      const result = await roomManager.leaveRoom(roomId, player2.token);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.gameState?.players.map((player) => player.id)).toEqual([
        player1Id,
        player3.playerId,
      ]);
      expect(result.gameState?.currentPlayerId).toBe(player3.playerId);
      expect(result.gameState?.phase).toBe('roll');
    });

    it('should drop the leaving player from the sessions map', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = await join(roomId, 'P2');

      await roomManager.leaveRoom(roomId, p2.token);

      // The old token must no longer authenticate anything.
      expect((await roomManager.reconnect(roomId, p2.token)).ok).toBe(false);
      // The host's token must still work.
      expect((await roomManager.reconnect(roomId, hostToken)).ok).toBe(true);
    });
  });

  describe('Game Lifecycle', () => {
    it('should start game only by host and with enough players', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');

      // Try starting with 1 player
      let result = await roomManager.startGame(roomId, hostToken);
      expect(result).toEqual({ ok: false, reason: 'conflict', message: expect.any(String) });

      // Add second player
      const p2Result = await join(roomId, 'P2');

      // Try starting by non-host
      result = await roomManager.startGame(roomId, p2Result.token);
      expect(result).toEqual({ ok: false, reason: 'conflict', message: expect.any(String) });

      // Start by host
      result = await roomManager.startGame(roomId, hostToken);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.status).toBe('game');
      expect(result.state.gameState?.players).toHaveLength(2);
      expect((await roomManager.getRoom(roomId))?.status).toBe('game');
    });

    it('should report unauthorized for an unknown token on start', async () => {
      const { roomId } = await roomManager.createRoom('Host');
      const result = await roomManager.startGame(roomId, 'ALIEN_TOKEN');
      expect(result).toEqual({ ok: false, reason: 'unauthorized', message: expect.any(String) });
    });

    it('should not start game in non-existent room', async () => {
      const result = await roomManager.startGame('INVALID', 'tok');
      expect(result).toEqual({ ok: false, reason: 'not_found', message: expect.any(String) });
    });
  });

  describe('Game Action Handling', () => {
    it('should handle game action in a started game', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // Assuming ROLL_DICE is a valid action for the current player
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const result = await roomManager.handleGameAction(roomId, hostToken, action);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.dice).toBeDefined();
    });

    it('rejects an action in a non-existent room', async () => {
      const action: any = { type: 'ROLL_DICE', playerId: 'uid' };
      const result = await roomManager.handleGameAction('INVALID', 'tok', action);
      expect(result.ok).toBe(false);
    });

    it('rejects an action when the game has not started', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      // Game not started yet (lobby status)
      const result = await roomManager.handleGameAction(roomId, hostToken, action);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected rejection');
      expect(result.message).toBe('Game has not started');
    });

    it('rejects a token used to act as another player', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2Result = await join(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // P2's token resolves to P2's id, but the action claims to be Host.
      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const result = await roomManager.handleGameAction(roomId, p2Result.token, action);

      expect(result.ok).toBe(false);
    });

    it('rejects an unknown token as unauthorized', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const action: any = { type: 'ROLL_DICE', playerId: hostId };
      const result = await roomManager.handleGameAction(roomId, 'ALIEN_TOKEN', action);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected rejection');
      expect(result.reason).toBe('unauthorized');
    });

    it('rejects a non-target trying to accept a trade', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = await join(roomId, 'P2');
      const p3 = await join(roomId, 'P3');
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

      expect(result.ok).toBe(false);
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('rejects a non-initiator trying to cancel a trade', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = await join(roomId, 'P2');
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

      expect(result.ok).toBe(false);
      expect((await roomManager.getRoom(roomId))?.gameState?.activeTrade).toBeTruthy();
    });

    it('rejects a client-issued RESET_GAME', async () => {
      const { roomId, token: hostToken } = await roomManager.createRoom('Host');
      await roomManager.joinRoom(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      // Even the host cannot reset via the action channel.
      const action: any = {
        type: 'RESET_GAME',
        players: [{ id: 'x', name: 'X', color: '#000' }],
      };
      const result = await roomManager.handleGameAction(roomId, hostToken, action);
      expect(result.ok).toBe(false);

      // Game state untouched — original players still present.
      const room = (await roomManager.getRoom(roomId))!;
      expect(room.gameState!.players).toHaveLength(2);
    });

    it('replays the identical dice roll when a CAS conflict retries the mutator', async () => {
      const store = new InMemoryRoomStore();
      const manager = new RoomManager(store);
      const { roomId, playerId, token } = await manager.createRoom('Host');
      const p2 = await manager.joinRoom(roomId, 'P2');
      if (!p2.ok) throw new Error('join failed');
      await manager.startGame(roomId, token);

      // Simulate a Redis WATCH conflict: the store invokes the mutator twice
      // with the same current state and persists the second result. Because
      // the RNG seed is generated outside the mutator, both invocations must
      // produce the exact same roll — a retry may never silently re-roll.
      const rolls: unknown[] = [];
      const realUpdate = store.update.bind(store);
      vi.spyOn(store, 'update').mockImplementation((id, mutator) =>
        realUpdate(id, (current) => {
          const first = mutator(current);
          const second = mutator(current);
          rolls.push(first?.gameState?.dice, second?.gameState?.dice);
          return second;
        })
      );

      const result = await manager.handleGameAction(roomId, token, {
        type: 'ROLL_DICE',
        playerId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(rolls).toHaveLength(2);
      expect(rolls[0]).toBeDefined();
      expect(rolls[0]).toEqual(rolls[1]);
      expect(result.state.dice).toEqual(rolls[1]);
    });

    it('ignores client-supplied dice values on ROLL_DICE', async () => {
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

      // Force the seed so we can assert the dice came from the server's own
      // deterministic roll, not the client-supplied die1/die2.
      const seedSpy = vi
        .spyOn(
          RoomManager.prototype as unknown as { generateRngSeed: () => number },
          'generateRngSeed'
        )
        .mockReturnValue(0);
      const result = await roomManager.handleGameAction(roomId, hostToken, cheatAction);
      seedSpy.mockRestore();

      const rng = mulberry32(0);
      const expectedDie1 = Math.floor(rng() * 6) + 1;
      const expectedDie2 = Math.floor(rng() * 6) + 1;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(result.state.dice).toEqual([expectedDie1, expectedDie2]);
      // The cheat action asked for [6, 6] — confirm the server didn't honor it.
      expect(result.state.dice).not.toEqual([6, 6]);
    });

    it('rejects (without disturbing) the existing trade when another proposal is submitted', async () => {
      const { roomId, playerId: hostId, token: hostToken } = await roomManager.createRoom('Host');
      const p2 = await join(roomId, 'P2');
      await roomManager.startGame(roomId, hostToken);

      const firstResult = await roomManager.handleGameAction(roomId, hostToken, {
        type: 'PROPOSE_TRADE',
        playerId: hostId,
        targetPlayerId: p2.playerId,
        offer: { money: 0, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });
      expect(firstResult.ok).toBe(true);
      if (!firstResult.ok) throw new Error('expected ok');
      const firstTradeId = firstResult.state.activeTrade?.id;
      expect(firstTradeId).toBeTruthy();

      const secondResult = await roomManager.handleGameAction(roomId, p2.token, {
        type: 'PROPOSE_TRADE',
        playerId: p2.playerId,
        targetPlayerId: hostId,
        offer: { money: 10, properties: [], getOutOfJailCards: 0 },
        request: { money: 0, properties: [], getOutOfJailCards: 0 },
      });

      // Soft-rejected: the second proposal doesn't overwrite the pending one,
      // and (per M5/M9) the private error is returned only to the caller,
      // never persisted or broadcast.
      expect(secondResult.ok).toBe(false);
      if (secondResult.ok) throw new Error('expected rejection');
      expect(secondResult.message).toMatch(/resolve the current trade/i);

      const room = await roomManager.getRoom(roomId);
      expect(room?.gameState?.activeTrade?.id).toBe(firstTradeId);
      expect(room?.gameState?.errorMessage).toBeUndefined();
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
