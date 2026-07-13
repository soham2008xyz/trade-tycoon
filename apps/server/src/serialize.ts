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
 */
export function toPublicGameState(state: GameState): GameState {
  // The leading destructure exists only to drop the field; the unused-vars
  // rule can't see that intent.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { errorMessage: _errorMessage, ...rest } = state;
  return rest;
}

export function toPublicLobbyState(state: LobbyState): LobbyState {
  // Destructure-and-drop, as above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sessions: _sessions, ...rest } = state;
  if (!rest.gameState) return rest;
  return { ...rest, gameState: toPublicGameState(rest.gameState) };
}
