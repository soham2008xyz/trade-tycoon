import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createInitialState } from '@trade-tycoon/game-logic';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3001;

// Simple in-memory game state
let gameState = createInitialState();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('game_state', gameState);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Trade Tycoon Server is Running');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
