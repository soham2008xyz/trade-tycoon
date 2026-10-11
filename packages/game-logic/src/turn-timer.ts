import type { GameState, TurnTimer, TurnTimerConfig } from './types';
import { forceEndTurn, passAuctionBidder, type Rng } from './reducer';

/**
 * Turn timers: a maximum time for each player's turn and, separately, for each
 * bidder's chance in an auction.
 *
 * The reducer stays free of clocks. The **server** is the only thing that
 * stamps deadlines (`stampTurnTimer`) and applies expiry (`expireTurnTimer`),
 * both as pure functions of an injected `now`, so the deadline lives in the
 * authoritative, CAS-protected game state rather than in any client. Hotseat
 * play never calls them, so it has no timers.
 */

/** Defaults agreed for the feature: a generous whole turn, a brisk auction bid. */
export const DEFAULT_TURN_TIMER_CONFIG: TurnTimerConfig = {
  turnLimitMs: 180_000,
  auctionLimitMs: 30_000,
};

/** What the clock is currently counting: the thing whose change re-arms it. */
export interface TimerSubject {
  kind: TurnTimer['kind'];
  playerId: string;
  key: string;
}

/**
 * The single thing being timed right now, or null when nothing should be (no
 * game, a winner, or no players). While an auction is open it is the current
 * bidder; otherwise it is the current player's turn.
 *
 * Keys are chosen so the clock re-arms exactly when the opportunity changes: a
 * new player's turn, a new bidder, or a new bid (the same bidder can be up
 * again after a lap with a higher bid to answer). Rolling doubles, buying or
 * managing property inside one turn leaves the key — and so the deadline —
 * alone.
 */
export const getTimerSubject = (state: GameState): TimerSubject | null => {
  if (state.winner || state.players.length === 0) return null;

  const { auction } = state;
  if (state.phase === 'auction' && auction) {
    const playerId = auction.participants[auction.currentBidderIndex];
    if (!playerId) return null;
    return {
      kind: 'auction',
      playerId,
      key: `auction:${auction.propertyId}:${playerId}:${auction.currentBid}:${auction.participants.length}`,
    };
  }

  if (!state.currentPlayerId) return null;
  return { kind: 'turn', playerId: state.currentPlayerId, key: `turn:${state.currentPlayerId}` };
};

const limitFor = (config: TurnTimerConfig, kind: TurnTimer['kind']): number =>
  kind === 'auction' ? config.auctionLimitMs : config.turnLimitMs;

/**
 * Returns `state` with its `timer` brought in line with what is now being
 * timed: re-armed to `now + limit` when the subject changed, cleared when
 * nothing (or a disabled timer) applies, and left as is when the subject is
 * unchanged — in which case the input is returned reference-equal.
 *
 * Call it on the result of every reducer step the server persists. It must
 * run **after** the server's rejected-action checks, which rely on an
 * unchanged reference meaning "nothing happened".
 */
export const stampTurnTimer = (state: GameState, now: number): GameState => {
  const config = state.timerConfig;
  const subject = config ? getTimerSubject(state) : null;
  const limit = config && subject ? limitFor(config, subject.kind) : 0;

  if (!subject || limit <= 0) {
    return state.timer ? { ...state, timer: null } : state;
  }
  if (state.timer?.key === subject.key) return state;

  return { ...state, timer: { ...subject, deadline: now + limit } };
};

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

/**
 * Client side: rebuilds the timer for display from a snapshot received at
 * `receivedAt` (local epoch ms). The server clock and the local clock may
 * disagree, so the countdown is anchored on the server-computed `remainingMs`
 * rather than on `deadline`. Returns the input untouched when there is no
 * timer to localize.
 */
export const localizeTurnTimer = (state: GameState, receivedAt: number): GameState => {
  const { timer } = state;
  if (!timer || timer.remainingMs === undefined) return state;
  return { ...state, timer: { ...timer, expiresAt: receivedAt + timer.remainingMs } };
};
