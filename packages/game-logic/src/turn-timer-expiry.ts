import type { GameState } from './types';
import { forceEndTurn, passAuctionBidder, type Rng } from './reducer';
import { stampTurnTimer } from './turn-timer';

/** True once the running timer's deadline has passed. */
export const isTurnTimerExpired = (state: GameState, now: number): boolean =>
  !!state.timer && !state.winner && now >= state.timer.deadline;

/**
 * Applies the automatic action for an expired timer and re-arms the clock for
 * whoever is up next; returns null when nothing is due.
 *
 * - Turn expired: the player's turn is ended (`forceEndTurn`).
 * - Auction expired: the bidder passes (`passAuctionBidder`).
 *
 * Only **one** step is taken per call, and the next deadline counts from
 * `now`. A room nobody touched for an hour therefore skips the one stalled
 * turn on first contact instead of running every seat's clock out in a row.
 */
export const expireTurnTimer = (state: GameState, now: number, rng: Rng): GameState | null => {
  if (!isTurnTimerExpired(state, now) || !state.timer) return null;

  const { kind, playerId } = state.timer;
  const name = state.players.find((p) => p.id === playerId)?.name ?? 'A player';
  const advanced = kind === 'auction' ? passAuctionBidder(state, rng) : forceEndTurn(state, rng);

  const note =
    kind === 'auction'
      ? `${name} ran out of time and passed.`
      : `${name} ran out of time. Turn skipped.`;
  const announced: GameState = {
    ...advanced,
    // The expiry's own announcement, appended to whatever the step itself said
    // (an auction won on the pass, an auction triggered by the skipped turn).
    toastMessage: [note, advanced.toastMessage].filter(Boolean).join(' '),
    logs: [...advanced.logs, `[Game] ${note}`],
  };
  // Guarantee progress: the same subject would otherwise re-expire forever.
  return stampTurnTimer({ ...announced, timer: null }, now);
};
