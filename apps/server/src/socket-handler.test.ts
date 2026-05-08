import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as IOServer, Socket as IOServerSocket } from 'socket.io';
import { io as ioClient, Socket as IOClient } from 'socket.io-client';
import { RoomManager } from './RoomManager';
import { registerSocketHandlers } from './socket-handler';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@trade-tycoon/game-logic';

type ServerType = IOServer<ClientToServerEvents, ServerToClientEvents>;
type ClientType = IOClient<ServerToClientEvents, ClientToServerEvents>;

const waitFor = <T>(
  socket: ClientType,
  event: keyof ServerToClientEvents,
  timeoutMs = 1000
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${String(event)}"`)),
      timeoutMs
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve((args.length === 1 ? args[0] : args) as T);
    });
  });

describe('socket handler integration', () => {
  let httpServer: HttpServer;
  let io: ServerType;
  let port: number;
  let clients: ClientType[] = [];

  const newClient = (): ClientType => {
    const c: ClientType = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    clients.push(c);
    return c;
  };

  beforeEach(async () => {
    httpServer = createServer();
    io = new IOServer(httpServer, { cors: { origin: '*' } });
    registerSocketHandlers(io, new RoomManager());
    await new Promise<void>((res) => httpServer.listen(0, res));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients = [];
    io.close();
    await new Promise<void>((res) => httpServer.close(() => res()));
  });

  it('emits a session_expired error when reconnect references an unknown room', async () => {
    const client = newClient();
    await new Promise<void>((res) => client.on('connect', () => res()));

    const errPromise = waitFor<string>(client, 'error');
    client.emit('reconnect', 'NONEXISTENT', 'fake-user-id');

    const msg = await errPromise;
    expect(msg.toLowerCase()).toContain('session');
  });

  it('lets a fresh joiner join a room even after a stale reconnect attempt for the same room', async () => {
    // Host creates a room
    const host = newClient();
    await new Promise<void>((res) => host.on('connect', () => res()));
    const hostJoined = waitFor<{ roomId: string; userId: string; isHost: boolean }>(
      host,
      'joined_room'
    );
    host.emit('create_room', 'Alice');
    const { roomId } = await hostJoined;

    // Joiner first emits a reconnect for the same room with a bogus userId,
    // then immediately tries to join properly with their real name. This mirrors the
    // browser scenario where a stale localStorage triggers a reconnect attempt
    // alongside the user's explicit join.
    const joiner = newClient();
    await new Promise<void>((res) => joiner.on('connect', () => res()));

    // Register listeners BEFORE emitting so we don't miss events.
    const joinerJoined = waitFor<{ roomId: string; userId: string; isHost: boolean }>(
      joiner,
      'joined_room'
    );
    const lobbyPromise = waitFor<{ players: { name: string }[] }>(joiner, 'lobby_update');

    joiner.emit('reconnect', roomId, 'unknown-user-id');
    joiner.emit('join_room', roomId, 'Bob');

    const data = await joinerJoined;
    expect(data.roomId).toBe(roomId);
    expect(data.isHost).toBe(false);
    expect(data.userId).toBeTruthy();

    const lobby = await lobbyPromise;
    expect(lobby.players.map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
  });
});
