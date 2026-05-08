import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';
import { registerSocketHandlers } from './socket-handler';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { ClientToServerEvents, ServerToClientEvents } from '@trade-tycoon/game-logic';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3001;

// Room Manager Instance — wired to in-memory storage for the local single-process
// dev server. Production deployments will swap in a Redis-backed store.
const roomManager = new RoomManager(new InMemoryRoomStore());

registerSocketHandlers(io, roomManager);

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
