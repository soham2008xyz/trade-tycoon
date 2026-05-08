import type { GameState, LobbyState } from '@trade-tycoon/game-logic';

/**
 * Push events that get broadcast to every subscriber of a given room.
 *
 * The shape mirrors the Socket.IO events the legacy server used so that the
 * SSE-driven client and the existing Socket.IO-driven client can be backed by
 * the same business logic during the transition.
 */
export type RoomEvent =
  | { type: 'lobby_update'; state: LobbyState }
  | { type: 'game_state_update'; state: GameState };

/**
 * Cross-instance fan-out for room events. The in-memory implementation is for
 * tests and single-process dev; the Redis implementation will use Redis
 * pub/sub so that events published in one Vercel function instance are
 * delivered to SSE streams held open by other instances.
 *
 * `subscribe` returns an unsubscribe handle that the SSE handler must call on
 * client disconnect to free up resources (and, in the Redis case, to stop the
 * underlying TCP subscriber).
 */
export interface EventBus {
  /** Broadcast an event to every current subscriber of `roomId`. */
  publish(roomId: string, event: RoomEvent): Promise<void>;

  /**
   * Subscribe to all events for `roomId` until the returned handle is invoked.
   * The handler will be called for every event published *after* the
   * subscription is registered — the SSE handler is responsible for first
   * sending an initial snapshot of the room state from `RoomStore` so that
   * the client never misses a logical update.
   */
  subscribe(roomId: string, handler: (event: RoomEvent) => void): Promise<() => void>;
}
