import { RoomManager } from '../RoomManager';
import { InMemoryRoomStore } from '../store/InMemoryRoomStore';
import type { RoomStore } from '../store/RoomStore';
import { InMemoryPresenceStore } from '../presence/InMemoryPresenceStore';
import { PRESENCE_TIMEOUT_MS, type PresenceStore } from '../presence/PresenceStore';

export const START = 1_000_000;
export const STALE = PRESENCE_TIMEOUT_MS + 1_000;

export interface Seat {
  playerId: string;
  token: string;
}

/**
 * Builds a started online game with `names.length` players (the first is the
 * host) on a controllable clock, so tests can age presence deterministically.
 */
export const setupGame = async (
  names: string[],
  overrides: { presence?: PresenceStore; store?: RoomStore } = {}
) => {
  const store = overrides.store ?? new InMemoryRoomStore();
  const presence = overrides.presence ?? new InMemoryPresenceStore();
  const clock = { now: START };
  const manager = new RoomManager(store, { presence, clock: () => clock.now });

  const created = await manager.createRoom(names[0]);
  const seats: Seat[] = [{ playerId: created.playerId, token: created.token }];
  for (const name of names.slice(1)) {
    const joined = await manager.joinRoom(created.roomId, name);
    if (!joined.ok) throw new Error(`join failed: ${joined.message}`);
    seats.push({ playerId: joined.playerId, token: joined.token });
  }
  const started = await manager.startGame(created.roomId, seats[0].token);
  if (!started.ok) throw new Error(`start failed: ${started.message}`);

  return { manager, store, presence, clock, roomId: created.roomId, seats };
};

/** Simulates bankruptcy: gone from the game roster, still in lobby + sessions. */
export const bankrupt = async (store: RoomStore, roomId: string, playerId: string) => {
  await store.update(roomId, (current) => ({
    ...current,
    gameState: current.gameState && {
      ...current.gameState,
      players: current.gameState.players.filter((p) => p.id !== playerId),
    },
  }));
};

/**
 * Ages the clock past the presence timeout while keeping `alive` players
 * polling, so exactly the others become disconnected.
 */
export const silenceAllBut = async (ctx: Awaited<ReturnType<typeof setupGame>>, alive: Seat[]) => {
  ctx.clock.now = ctx.clock.now + STALE;
  for (const seat of alive) await ctx.manager.recordSeen(ctx.roomId, seat.playerId);
};
