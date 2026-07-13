import type { LobbyState } from '@trade-tycoon/game-logic';

/**
 * Thrown by `RoomStore.update` implementations when they give up retrying a
 * write conflict (e.g. the Redis CAS loop exhausting its retry budget under
 * heavy contention on one room). Distinct from a plain `Error` so the route
 * layer's error middleware can map it to 503 instead of a generic 500 — the
 * request didn't fail because of a bug, it failed because it lost a race and
 * the client should simply retry.
 */
export class StoreConflictError extends Error {
  constructor(roomId: string) {
    super(`Too many conflicting writes to room ${roomId}; try again`);
    this.name = 'StoreConflictError';
  }
}

/**
 * Persistence boundary for room state. The interface is intentionally minimal:
 * a `get`, an `update` for atomic read-modify-write, and a `delete`. `update`
 * is the only mutation primitive — callers must not write a state they did not
 * derive from a state they just read, because in a multi-instance deployment
 * (Vercel serverless) two requests racing on the same room can clobber each
 * other otherwise. The Redis impl uses WATCH/MULTI/EXEC to detect the conflict
 * and retry; the in-memory impl is single-process so the mutator just runs
 * synchronously.
 */
export interface RoomStore {
  /** Returns the current state of `roomId`, or `null` if it has never been written / has expired. */
  get(roomId: string): Promise<LobbyState | null>;

  /**
   * Insert a new room. Returns `false` if a room with that id already exists,
   * so callers can retry with a different id without the risk of clobbering an
   * existing room.
   */
  create(state: LobbyState): Promise<boolean>;

  /**
   * Atomically read-modify-write `roomId`. The mutator receives the current
   * state and returns either a new state (which is written back) or `null` to
   * abort the update. Returns the written state, or `null` if the room is
   * missing or the mutator aborted.
   *
   * The mutator MUST be a pure function of the current state — it may be
   * invoked more than once per call if a Redis WATCH conflict triggers a retry.
   */
  update(
    roomId: string,
    mutator: (current: LobbyState) => LobbyState | null
  ): Promise<LobbyState | null>;

  /** Remove a room. Idempotent. */
  delete(roomId: string): Promise<void>;
}
