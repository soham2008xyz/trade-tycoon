import express from 'express';
import cors from 'cors';
import { RoomManager } from './RoomManager';
import { InMemoryRoomStore } from './store/InMemoryRoomStore';
import { InMemoryEventBus } from './events/InMemoryEventBus';
import { createRoomsRouter } from './routes/rooms';
import { createEventsRouter } from './routes/events';

const app = express();

const PORT = process.env.PORT || 3001;

// Room Manager + EventBus — wired to in-memory implementations for the local
// single-process dev server. Production deployments swap in Redis-backed
// implementations via env (see store/RedisRoomStore and events/RedisEventBus).
const roomManager = new RoomManager(new InMemoryRoomStore());
const eventBus = new InMemoryEventBus();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '64kb' }));
app.use(createRoomsRouter({ roomManager, eventBus }));
app.use(createEventsRouter({ roomManager, eventBus }));

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

// Health check for load balancers / Vercel.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export the Express app so tests (and Vercel's auto-detection) can import it
// without re-binding the port.
export default app;
