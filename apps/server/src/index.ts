import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createInitialState } from '@trade-tycoon/game-logic';
import { RoomManager } from './RoomManager';
import { registerSocketHandlers } from './socket-handler';
import { ClientToServerEvents, ServerToClientEvents } from '@trade-tycoon/game-logic';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3001;

// Room Manager Instance
const roomManager = new RoomManager();

registerSocketHandlers(io, roomManager);

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
