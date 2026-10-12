import { removePlayerFromGame, stampTurnTimer, type LobbyState } from '@trade-tycoon/game-logic';

/**
 * The single definition of "this player is no longer in the room": drops
 * their lobby entry and session, reassigns the host if needed, and removes
 * them from the running game (which advances the turn and unwinds auctions
 * and trades). Shared by a player leaving and by the room removing a
 * disconnected player so the two paths cannot drift apart.
 *
 * Pure function of `current` and `now` (it runs inside store mutators, which
 * may be retried; callers read the clock once, outside). The caller must have
 * checked that `userId` is in the lobby. `now` re-arms the turn clock, since
 * removing the current player (or a bidder) changes whose turn it is.
 */
export function removePlayerFromLobby(
  current: LobbyState,
  userId: string,
  now: number
): LobbyState {
  const remainingPlayers = current.players.filter((entry) => entry.id !== userId);
  const hasHost = remainingPlayers.some((candidate) => candidate.isHost);
  const lobbyOnly: LobbyState = {
    ...current,
    players: remainingPlayers.map((entry, index) => ({
      ...entry,
      isHost: hasHost ? entry.isHost : index === 0,
    })),
    sessions: Object.fromEntries(
      Object.entries(current.sessions ?? {}).filter(([, id]) => id !== userId)
    ),
  };

  // Nobody left (or no game was running): the room is back to a bare lobby.
  if (lobbyOnly.players.length === 0) {
    return { ...lobbyOnly, status: 'lobby' as const, gameState: undefined };
  }
  if (!current.gameState) return lobbyOnly;

  // A finished game is a frozen snapshot. `removePlayerFromGame` skips the
  // reducer's post-game guard, and bankrupt players are already gone from
  // `gameState.players`, so the winner leaving would empty the roster and
  // reset `winner` — dropping the game-over screen for everyone still
  // connected. Keep the snapshot; only the lobby entry and session go.
  if (current.gameState.winner) return lobbyOnly;

  const nextGameState = stampTurnTimer(removePlayerFromGame(current.gameState, userId), now);
  if (nextGameState.players.length === 0) {
    return { ...lobbyOnly, status: 'lobby' as const, gameState: undefined };
  }
  return { ...lobbyOnly, gameState: nextGameState };
}
