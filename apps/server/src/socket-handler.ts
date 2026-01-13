import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { ClientToServerEvents, ServerToClientEvents } from '@trade-tycoon/game-logic';

export const registerSocketHandlers = (io: Server<ClientToServerEvents, ServerToClientEvents>, roomManager: RoomManager) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create_room', (playerName: string) => {
      const roomId = roomManager.createRoom(playerName);
      const room = roomManager.getRoom(roomId);

      if (room && room.players.length > 0) {
         // The host is the first player created in createRoom
         const host = room.players[0];
         socket.join(roomId);
         socket.emit('joined_room', { roomId, userId: host.id, isHost: true });
         socket.emit('lobby_update', room);
      } else {
         socket.emit('error', 'Failed to create room.');
      }
    });

    socket.on('join_room', (roomId: string, playerName: string) => {
      const result = roomManager.joinRoom(roomId, playerName);
      if (result) {
        socket.join(roomId);
        socket.emit('joined_room', { roomId, userId: result.userId, isHost: false });
        io.to(roomId).emit('lobby_update', result.state);
      } else {
        socket.emit('error', 'Could not join room. It may be full or started.');
      }
    });

    socket.on('reconnect', (roomId: string, userId: string) => {
        const result = roomManager.reconnect(roomId, userId);
        if (result) {
            socket.join(roomId);
            socket.emit('lobby_update', result.state);
            if (result.gameState) {
                socket.emit('game_state_update', result.gameState);
            }
        } else {
             // socket.emit('error', 'Session expired');
        }
    });

    socket.on('update_player', (roomId: string, userId: string, name: string, color: string) => {
       const newState = roomManager.updatePlayer(roomId, userId, name, color);
       if (newState) {
           io.to(roomId).emit('lobby_update', newState);
       }
    });

    socket.on('start_game', (roomId: string, userId: string) => {
        const gameState = roomManager.startGame(roomId, userId);
        if (gameState) {
            io.to(roomId).emit('game_state_update', gameState);
        } else {
            socket.emit('error', 'Failed to start game. Only host can start and need 2+ players.');
        }
    });

    socket.on('game_action', (roomId: string, userId: string, action) => {
        // Validation: Ensure action matches user?
        // For MVP, we pass the action to reducer.
        // The reducer checks playerId match for most actions (e.g. ROLL_DICE checks state.currentPlayerId).
        // However, we should verify that `userId` provided matches the `playerId` in the action if applicable?
        // Actually, some actions like JOIN_GAME don't apply here.
        // Let's trust the client logic + reducer checks for now.
        // But we should ensure `userId` is actually a player in this game.

        const room = roomManager.getRoom(roomId);
        if (!room || !room.gameState) return;

        const player = room.gameState.players.find(p => p.id === userId);
        if (!player) {
            socket.emit('error', 'You are not in this game.');
            return;
        }

        // Additional Security: Check if action.playerId === userId
        // This prevents User A from sending "User B rolls dice" action.
        if ('playerId' in action && action.playerId !== userId) {
             socket.emit('error', 'You cannot perform actions for another player.');
             return;
        }

        const newState = roomManager.handleGameAction(roomId, action);
        if (newState) {
            io.to(roomId).emit('game_state_update', newState);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // We don't remove player from room immediately to allow reconnect.
    });
  });
};
