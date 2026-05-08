import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { ClientToServerEvents, ServerToClientEvents } from '@trade-tycoon/game-logic';

export const registerSocketHandlers = (
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create_room', async (playerName: string) => {
      console.log(`[create_room] Player: ${playerName}`);
      try {
        const roomId = await roomManager.createRoom(playerName);
        const room = await roomManager.getRoom(roomId);

        if (room && room.players.length > 0) {
          // The host is the first player created in createRoom
          const host = room.players[0];
          socket.join(roomId);
          socket.emit('joined_room', { roomId, userId: host.id, isHost: true });
          socket.emit('lobby_update', room);
          console.log(`[create_room] Room ${roomId} created by ${host.id}`);
        } else {
          console.error('[create_room] Failed to create room');
          socket.emit('error', 'Failed to create room.');
        }
      } catch (err) {
        console.error('[create_room] Error', err);
        socket.emit('error', 'Failed to create room.');
      }
    });

    socket.on('join_room', async (roomId: string, playerName: string) => {
      console.log(`[join_room] Room: ${roomId}, Player: ${playerName}`);
      const result = await roomManager.joinRoom(roomId, playerName);
      if (result) {
        socket.join(roomId);
        socket.emit('joined_room', { roomId, userId: result.userId, isHost: false });
        io.to(roomId).emit('lobby_update', result.state);
        console.log(`[join_room] User ${result.userId} joined room ${roomId}`);
      } else {
        console.warn(`[join_room] Failed to join room ${roomId}`);
        socket.emit('error', 'Could not join room. It may be full or started.');
      }
    });

    socket.on('reconnect', async (roomId: string, userId: string) => {
      console.log(`[reconnect] Room: ${roomId}, User: ${userId}`);
      const result = await roomManager.reconnect(roomId, userId);
      if (result) {
        socket.join(roomId);
        socket.emit('lobby_update', result.state);
        if (result.gameState) {
          socket.emit('game_state_update', result.gameState);
        }
        console.log(`[reconnect] User ${userId} reconnected to ${roomId}`);
      } else {
        console.warn(`[reconnect] Failed to reconnect user ${userId} to ${roomId}`);
        socket.emit('error', 'session_expired');
      }
    });

    socket.on(
      'update_player',
      async (roomId: string, userId: string, name: string, color: string) => {
        console.log(`[update_player] Room: ${roomId}, User: ${userId}`);
        const newState = await roomManager.updatePlayer(roomId, userId, name, color);
        if (newState) {
          io.to(roomId).emit('lobby_update', newState);
        } else {
          console.warn(`[update_player] Failed to update player ${userId} in room ${roomId}`);
        }
      }
    );

    socket.on('start_game', async (roomId: string, userId: string) => {
      console.log(`[start_game] Room: ${roomId}, User: ${userId}`);
      const gameState = await roomManager.startGame(roomId, userId);
      if (gameState) {
        io.to(roomId).emit('game_state_update', gameState);

        // Fix: Also emit lobby_update so clients know status changed to 'game'
        const room = await roomManager.getRoom(roomId);
        if (room) {
          io.to(roomId).emit('lobby_update', room);
        }
        console.log(`[start_game] Game started in room ${roomId}`);
      } else {
        console.warn(`[start_game] Failed to start game in room ${roomId} by user ${userId}`);
        socket.emit('error', 'Failed to start game. Only host can start and need 2+ players.');
      }
    });

    socket.on('game_action', async (roomId: string, userId: string, action) => {
      console.log(`[game_action] Room: ${roomId}, User: ${userId}, Action: ${action.type}`);
      const room = await roomManager.getRoom(roomId);
      if (!room || !room.gameState) {
        console.warn(`[game_action] Room ${roomId} not found or game not started`);
        return;
      }

      const player = room.gameState.players.find((p) => p.id === userId);
      if (!player) {
        console.warn(`[game_action] User ${userId} not in game ${roomId}`);
        socket.emit('error', 'You are not in this game.');
        return;
      }

      const newState = await roomManager.handleGameAction(roomId, userId, action);
      if (newState) {
        io.to(roomId).emit('game_state_update', newState);
      } else {
        console.warn(
          `[game_action] Action ${action.type} by ${userId} rejected (security or state mismatch)`
        );
        socket.emit('error', 'Action rejected: not authorized or invalid.');
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // We don't remove player from room immediately to allow reconnect.
    });
  });
};
