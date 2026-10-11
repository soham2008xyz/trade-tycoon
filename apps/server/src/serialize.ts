import type { GameState, LobbyState } from '@trade-tycoon/game-logic';

/**
 * Wire-format boundary. Every HTTP response and every `eventBus.publish` must
 * go through `toPublicLobbyState` before it reaches a client, so that
 * server-internal fields (session tokens) never leak. Centralizing this
 * replaces the old per-call-site "remember to strip" pattern.
 *
 * `errorMessage` is private per-player feedback: the acting player receives
 * it in the 409 response body, and `handleGameAction` aborts before an
 * errorMessage-bearing state can be persisted or broadcast. Stripping it
 * here too is defense in depth — the boundary holds even if a future code
 * path persists one.
 *
 * `now` is the server clock at serialization. A running turn timer gets a
 * `remainingMs` computed from it so clients with a skewed clock still count
 * down correctly; it is wire-only and never stored. Callers inside
 * `RoomManager` pass its injectable clock.
 */
export function toPublicGameState(state: GameState, now: number = Date.now()): GameState {
  const { errorMessage, ...rest } = state;
  void errorMessage; // destructured only to drop the field from the returned object
  if (!rest.timer) return rest;
  return { ...rest, timer: { ...rest.timer, remainingMs: Math.max(0, rest.timer.deadline - now) } };
}

export function toPublicLobbyState(state: LobbyState, now: number = Date.now()): LobbyState {
  const { sessions, ...rest } = state;
  void sessions; // destructured only to drop the field from the returned object
  if (!rest.gameState) return rest;
  return { ...rest, gameState: toPublicGameState(rest.gameState, now) };
}
