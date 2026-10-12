import type { GameState } from './types';
import { BOARD } from './board-data';
import { clearSettledDebts } from './debt';
import { removePlayerAndCleanup } from './player-removal';
import { reduceAuctionAction } from './auction-actions';
import { reducePropertyAction } from './property-actions';
import { reduceTradeAction } from './trade-actions';
import { passTurn, reduceTurnAction } from './turn-actions';
import { ACTION_REJECTED, type Action, type GameReducerResult, type Rng } from './reducer-types';

// The action/result types are defined in `reducer-types.ts` (the handler
// modules need them without importing this file back); re-export them so the
// package's public surface stays `./reducer`.
export { ACTION_REJECTED };
export type { Action, ActionRejected, GameReducerResult, Rng } from './reducer-types';

// Actions that must be ignored once a winner is declared. The game is over —
// only RESET_GAME (start a new game) and DISMISS_* (clear UI banners) remain.
const POST_GAME_ALLOWED: ReadonlySet<Action['type']> = new Set([
  'RESET_GAME',
  'DISMISS_ERROR',
  'DISMISS_TOAST',
]);

export const gameReducer = (state: GameState, action: Action): GameState => {
  const result = reduceGameAction(state, action);
  return result === ACTION_REJECTED ? state : result;
};

/**
 * Logs are UI history, not gameplay state — cap so a long game's payload/storage stays bounded.
 * Sized for roughly 25 rounds of four players now that every roll and turn end is logged.
 */
const MAX_LOGS = 400;

const capLogs = (state: GameState): GameState => {
  if (state.logs.length <= MAX_LOGS) return state;
  return { ...state, logs: state.logs.slice(-MAX_LOGS) };
};

/**
 * Server-side helper for removing a player from an in-progress online game.
 * This is intentionally not a public client action because only the server
 * should be able to drop a player after they leave the room. Bypasses
 * `reduceGameAction`, so it applies the log cap itself.
 */
export const removePlayerFromGame = (state: GameState, playerId: string): GameState =>
  capLogs(removePlayerAndCleanup(state, playerId, 'left the game'));

/**
 * Routes `action` to the module that owns its rules. Each handler group
 * answers `undefined` for actions that are not its own, so the first group
 * that recognises the action decides; anything unrecognised is a no-op.
 */
const reduceGameActionUnbounded = (
  state: GameState,
  action: Action,
  rng: Rng
): GameReducerResult => {
  if (state.winner && !POST_GAME_ALLOWED.has(action.type)) {
    return state;
  }

  return (
    reduceTurnAction(state, action, rng) ??
    reducePropertyAction(state, action) ??
    reduceAuctionAction(state, action) ??
    reduceTradeAction(state, action) ??
    state
  );
};

/**
 * Public entry point. Delegates to the unbounded reducer above, then settles
 * stale debts and caps `logs` at `MAX_LOGS` — single choke points instead of
 * touching every one of the reducer's ~25 money/log sites.
 */
export const reduceGameAction = (
  state: GameState,
  action: Action,
  rng: Rng = Math.random
): GameReducerResult => {
  const result = reduceGameActionUnbounded(state, action, rng);
  if (result === ACTION_REJECTED) return result;
  // A no-op must stay reference-equal (the server's rejection signal), even if
  // the input carried a stale debt that clearSettledDebts would otherwise copy.
  return result === state ? state : capLogs(clearSettledDebts(result));
};

/**
 * Turn-timer expiry for the current player's turn (server-side; not a client
 * action). Tries the ordinary END_TURN first so the usual consequences apply —
 * ending on an unowned tile sends it to auction — and only when the player is
 * unable to end normally (negative funds) skips them anyway: the clock must be
 * able to advance a stalled table, and the debt stays theirs to settle next
 * turn.
 */
export const forceEndTurn = (state: GameState, rng: Rng = Math.random): GameState => {
  const ended = reduceGameAction(state, { type: 'END_TURN', playerId: state.currentPlayerId }, rng);
  if (ended !== ACTION_REJECTED && ended !== state && !ended.errorMessage) return ended;
  const player = state.players.find((p) => p.id === state.currentPlayerId);
  return capLogs(passTurn(state, player?.name));
};

/**
 * Turn-timer expiry for an auction bidder: they pass (CONCEDE_AUCTION). A
 * bidder who is currently the high bidder can't concede, so the auction is
 * settled in their favour instead — it can't be left running with nobody able
 * to move.
 */
export const passAuctionBidder = (state: GameState, rng: Rng = Math.random): GameState => {
  const auction = state.auction;
  if (state.phase !== 'auction' || !auction) return state;
  const bidderId = auction.participants[auction.currentBidderIndex];
  const conceded = reduceGameAction(state, { type: 'CONCEDE_AUCTION', playerId: bidderId }, rng);
  if (conceded !== ACTION_REJECTED && conceded !== state && !conceded.errorMessage) return conceded;

  const winner = state.players.find((p) => p.id === auction.highestBidderId);
  if (!winner) {
    return capLogs({
      ...state,
      phase: 'action',
      auction: null,
      toastMessage: 'Auction cancelled. No bidders.',
      logs: [...state.logs, `[Game] Auction cancelled.`],
    });
  }
  const tileName = BOARD.find((t) => t.id === auction.propertyId)?.name;
  return capLogs({
    ...state,
    players: state.players.map((p) =>
      p.id === winner.id
        ? {
            ...p,
            money: p.money - auction.currentBid,
            properties: [...p.properties, auction.propertyId],
          }
        : p
    ),
    phase: 'action',
    auction: null,
    toastMessage: `${winner.name} won the auction for $${auction.currentBid}!`,
    logs: [
      ...state.logs,
      `[${winner.name}] Won auction for ${tileName} at $${auction.currentBid}.`,
    ],
  });
};
