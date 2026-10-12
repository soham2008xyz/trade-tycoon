import type { Action, ActionOf, GameReducerResult } from './reducer-types';
import type { AuctionState, GameState, Player, Tile } from './types';
import { BOARD } from './board-data';

/**
 * Opens an auction for `tile` with every player as a bidder. Shared by
 * DECLINE_BUY and END_TURN (ending a turn on an unowned tile is a decline) so
 * both paths agree. The turn holder and `doublesCount` are left untouched, so
 * the lander keeps their turn (and any pending double).
 */
export const startAuction = (state: GameState, tile: Tile): GameState => ({
  ...state,
  phase: 'auction',
  auction: {
    propertyId: tile.id,
    currentBid: 0,
    highestBidderId: null,
    participants: state.players.map((p) => p.id),
    currentBidderIndex: 0,
  },
  // A no-sale auction drops back to 'action' with the lander still on this
  // unowned tile; remember it so End Turn doesn't auction it again forever.
  auctionedPropertyId: tile.id,
  // A stale rejection (e.g. a failed purchase) would otherwise outrank the
  // announcement in local hotseat feedback and ride along through the auction.
  errorMessage: undefined,
  toastMessage: `Auction started for ${tile.name}!`,
  logs: [...state.logs, `[Game] Auction started for ${tile.name}.`],
});

/** Closes `auction`, charging `winnerId` the `cost` and giving them the property. */
const awardAuction = (
  state: GameState,
  auction: AuctionState,
  winnerId: string,
  cost: number
): GameState => {
  const winner = state.players.find((p) => p.id === winnerId);
  if (!winner) return state;
  const tile = BOARD.find((t) => t.id === auction.propertyId);
  const paid: Player = {
    ...winner,
    money: winner.money - cost,
    properties: [...winner.properties, auction.propertyId],
  };
  return {
    ...state,
    players: state.players.map((p) => (p === winner ? paid : p)),
    phase: 'action',
    auction: null,
    toastMessage: `${winner.name} won the auction for $${cost}!`,
    logs: [...state.logs, `[${winner.name}] Won auction for ${tile?.name} at $${cost}.`],
  };
};

/** Why `player` cannot bid `amount` right now, or `undefined` when the bid is fine. */
const bidRejection = (
  auction: AuctionState,
  player: Player,
  amount: number
): string | undefined => {
  if (!Number.isSafeInteger(amount) || amount < 0) return 'Invalid bid amount.';
  if (amount <= auction.currentBid) return 'Bid must be higher than current bid.';
  if (player.money < amount) return 'Insufficient funds.';
  return undefined;
};

const placeBid = (state: GameState, action: ActionOf<'PLACE_BID'>): GameReducerResult => {
  const { auction } = state;
  if (state.phase !== 'auction' || !auction) return state;
  if (!auction.participants.includes(action.playerId))
    return { ...state, errorMessage: 'You are not in this auction.' };

  // Turn Check
  const expectedBidderId = auction.participants[auction.currentBidderIndex];
  if (action.playerId !== expectedBidderId) {
    return { ...state, errorMessage: 'It is not your turn to bid.' };
  }

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return state;

  const rejection = bidRejection(auction, player, action.amount);
  if (rejection) return { ...state, errorMessage: rejection };

  // Check for immediate win (only 1 participant)
  if (auction.participants.length === 1) {
    return awardAuction(state, auction, action.playerId, action.amount);
  }

  return {
    ...state,
    auction: {
      ...auction,
      currentBid: action.amount,
      highestBidderId: action.playerId,
      currentBidderIndex: (auction.currentBidderIndex + 1) % auction.participants.length,
    },
    toastMessage: `${player.name} bid $${action.amount}.`,
    logs: [...state.logs, `[${player.name}] Bid $${action.amount}.`],
  };
};

const concedeAuction = (
  state: GameState,
  action: ActionOf<'CONCEDE_AUCTION'>
): GameReducerResult => {
  const { auction } = state;
  if (state.phase !== 'auction' || !auction) return state;
  if (!auction.participants.includes(action.playerId)) return state;

  // Turn Check
  const expectedBidderId = auction.participants[auction.currentBidderIndex];
  if (action.playerId !== expectedBidderId) {
    return { ...state, errorMessage: 'It is not your turn to fold.' };
  }

  // Cannot concede if you are the high bidder
  if (action.playerId === auction.highestBidderId) {
    return { ...state, errorMessage: 'You cannot concede while you are the highest bidder.' };
  }

  const participants = auction.participants.filter((id) => id !== action.playerId);

  // If no one left, auction ends with no sale
  if (participants.length === 0) {
    return {
      ...state,
      phase: 'action',
      auction: null,
      toastMessage: 'Auction cancelled. No bidders.',
      logs: [...state.logs, `[Game] Auction cancelled.`],
    };
  }

  // If the one remaining player is the highest bidder, they win immediately.
  // Otherwise (e.g. no bids yet) they stay in the auction alone until they bid or concede.
  if (participants.length === 1 && participants[0] === auction.highestBidderId) {
    return awardAuction(state, auction, participants[0], auction.currentBid);
  }

  const player = state.players.find((p) => p.id === action.playerId);
  return {
    ...state,
    auction: {
      ...auction,
      participants,
      // The conceder left, so the same index now points at the next bidder (wrapped to the new length).
      currentBidderIndex: auction.currentBidderIndex % participants.length,
    },
    toastMessage: `${player?.name} conceded.`,
    logs: [...state.logs, `[${player?.name}] Conceded auction.`],
  };
};

export const reduceAuctionAction = (
  state: GameState,
  action: Action
): GameReducerResult | undefined => {
  switch (action.type) {
    case 'PLACE_BID':
      return placeBid(state, action);
    case 'CONCEDE_AUCTION':
      return concedeAuction(state, action);
    default:
      return undefined;
  }
};
