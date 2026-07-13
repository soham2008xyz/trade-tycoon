import type { GameState, LobbyState } from '@trade-tycoon/game-logic';

/**
 * Wire-format boundary. Every HTTP response and every `eventBus.publish` must
 * go through `toPublicLobbyState` before it reaches a client, so that
 * server-internal fields (session tokens) never leak. Centralizing this
 * replaces the old per-call-site "remember to strip" pattern.
 *
 * `GameState` no longer carries the static board (it was identical on every
 * room and every action, just re-serialized and CAS-compared for nothing —
 * the client already imports the same `BOARD` constant from game-logic), so
 * this is currently an identity function; kept as a named pass-through so a
 * future server-only `GameState` field has an obvious place to strip.
 */
export function toPublicGameState(state: GameState): GameState {
  return state;
}

export function toPublicLobbyState(state: LobbyState): LobbyState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sessions: _sessions, ...rest } = state;
  if (!rest.gameState) return rest;
  return { ...rest, gameState: toPublicGameState(rest.gameState) };
}
