import type { GameState } from '@trade-tycoon/game-logic';

/** What the game-over card shows about the winner. */
export interface GameOverSummary {
  winnerId: string;
  name: string;
  color: string;
  cash: number;
  propertyCount: number;
}

const UNKNOWN_WINNER_COLOR = '#9ca3af';

/**
 * Summary of the finished game, or `null` while it is still in progress.
 *
 * Bankrupt (and departed) players are removed from `state.players`, so once
 * `winner` is set the winner is the only player left — there are no losing
 * standings to list. The fallback for a `winner` id that matches nobody keeps
 * the game-over screen up (rather than reverting to a dead turn panel) if the
 * invariant is ever broken.
 */
export const getGameOverSummary = (
  state: Pick<GameState, 'winner' | 'players'>
): GameOverSummary | null => {
  if (!state.winner) return null;
  const player = state.players.find((p) => p.id === state.winner);
  if (!player) {
    return {
      winnerId: state.winner,
      name: 'Unknown player',
      color: UNKNOWN_WINNER_COLOR,
      cash: 0,
      propertyCount: 0,
    };
  }
  return {
    winnerId: player.id,
    name: player.name,
    color: player.color,
    cash: player.money,
    propertyCount: player.properties.length,
  };
};

/**
 * Headline for the game-over card. Online, the winner's own client reads
 * "You win!"; everyone else (including bankrupt players still watching)
 * sees the winner's name. In hotseat every player shares one device, so
 * there is no "you" — always name the winner.
 */
export const getGameOverTitle = (
  summary: Pick<GameOverSummary, 'winnerId' | 'name'>,
  myPlayerId: string | undefined,
  isMultiplayer: boolean
): string =>
  isMultiplayer && summary.winnerId === myPlayerId ? 'You win!' : `${summary.name} wins!`;
