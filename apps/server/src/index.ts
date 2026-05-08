import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';
import { registerSocketHandlers } from './socket-handler';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { InMemoryEventBus } from './events/InMemoryEventBus';
import { createRoomsRouter } from './routes/rooms';
import { createEventsRouter } from './routes/events';
import { ClientToServerEvents, ServerToClientEvents } from '@trade-tycoon/game-logic';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3001;

// Room Manager + EventBus — wired to in-memory implementations for the local
// single-process dev server. Production deployments will swap in
// Redis-backed implementations via env-based wiring (see store/RedisRoomStore
// and events/RedisEventBus once added).
const roomManager = new RoomManager(new InMemoryRoomStore());
const eventBus = new InMemoryEventBus();

// Socket.IO control plane — kept during the transition. The REST/SSE plane
// below is what production clients will use.
registerSocketHandlers(io, roomManager);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '64kb' }));
app.use(createRoomsRouter({ roomManager, eventBus }));
app.use(createEventsRouter({ roomManager, eventBus }));

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
