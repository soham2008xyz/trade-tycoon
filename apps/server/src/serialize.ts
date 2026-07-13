import type { GameState, LobbyState } from '@trade-tycoon/game-logic';

/**
 * Wire-format boundary. Every HTTP response and every `eventBus.publish` must
 * go through one of these before it reaches a client, so that server-internal
 * fields (the static board, session tokens) never leak. Centralizing this
 * replaces the old per-call-site "remember to strip" pattern.
 */

export function toPublicGameState(state: GameState): GameState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { board: _board, ...rest } = state as GameState & { board?: unknown };
  return rest as GameState;
}

export function toPublicLobbyState(state: LobbyState): LobbyState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sessions: _sessions, ...rest } = state;
  if (!rest.gameState) return rest;
  return { ...rest, gameState: toPublicGameState(rest.gameState) };
}
