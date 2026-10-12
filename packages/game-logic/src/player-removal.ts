import type { AuctionState, GameState, Player, TradeRequest } from './types';
import { BOARD } from './board-data';
import { withoutDebt } from './debt';
import { getMortgageInterest } from './helpers';
import { jailDecksHeldBy, moveJailCards, resolveJailCardHolders } from './jail-cards';

/**
 * Who inherits `debtor`'s assets on bankruptcy, or `undefined` for the bank.
 * Only a genuine outstanding debt counts: declaring while solvent, with a bank
 * debt (tax, fine, repairs), or after the creditor has left the game forfeits
 * everything to the bank.
 */
export const bankruptcyCreditorId = (state: GameState, debtor: Player): string | undefined => {
  const { debtOwedTo } = debtor;
  if (debtor.money >= 0 || debtOwedTo === undefined || debtOwedTo === debtor.id) return undefined;
  return state.players.some((p) => p.id === debtOwedTo) ? debtOwedTo : undefined;
};

/**
 * Moves everything a bankrupt player owns to `creditor`, per standard rules:
 * - properties transfer with their mortgage flag intact, and the creditor
 *   pays the standard 10% interest on each mortgaged one straight away. The
 *   property stays mortgaged (the creditor can lift it later with UNMORTGAGE_PROPERTY).
 *   Interest is charged even if it pushes the creditor below $0, like rent;
 *   it is owed to the bank, so it sets no `debtOwedTo`;
 * - buildings are sold back to the bank at half price and the proceeds go to
 *   the creditor, so properties arrive bare;
 * - any Get Out of Jail Free cards transfer;
 * - positive cash (never the case for a genuine debtor) transfers too, but a
 *   negative balance is NOT charged to the creditor: the unpaid shortfall is
 *   written off. The creditor was already credited the full payment when the
 *   debt arose (rent is credited in full even if the payer is short), so
 *   clawing it back would be a surprising second penalty.
 * Returns the updated creditor plus the building proceeds and mortgage
 * interest for logging.
 */
const transferAssets = (
  debtor: Player,
  creditor: Player
): { creditor: Player; buildingProceeds: number; mortgageInterest: number } => {
  const buildingProceeds = Object.entries(debtor.houses).reduce((sum, [propertyId, count]) => {
    const houseCost = BOARD.find((t) => t.id === propertyId)?.houseCost ?? 0;
    return sum + count * (houseCost / 2);
  }, 0);
  const mortgageInterest = debtor.mortgaged.reduce(
    (sum, propertyId) =>
      sum + getMortgageInterest(BOARD.find((t) => t.id === propertyId)?.mortgageValue ?? 0),
    0
  );
  return {
    buildingProceeds,
    mortgageInterest,
    creditor: {
      ...creditor,
      money: creditor.money + Math.max(0, debtor.money) + buildingProceeds - mortgageInterest,
      properties: [...creditor.properties, ...debtor.properties],
      mortgaged: [...creditor.mortgaged, ...debtor.mortgaged],
      getOutOfJailCards: creditor.getOutOfJailCards + debtor.getOutOfJailCards,
    },
  };
};

/** Toast fragments and log lines produced by one step of a player's removal. */
interface RemovalNotes {
  toast: string[];
  logs: string[];
}

/** Hands `player`'s assets to `inheritorId` when that player is still in `players`. */
const giveAssetsToInheritor = (
  player: Player,
  players: Player[],
  inheritorId?: string
): { players: Player[]; assetsNote?: string; logs: string[] } => {
  const inheritor = inheritorId ? players.find((p) => p.id === inheritorId) : undefined;
  if (!inheritor) return { players, logs: [] };
  const { creditor, buildingProceeds, mortgageInterest } = transferAssets(player, inheritor);
  const sold =
    buildingProceeds > 0
      ? `their buildings were sold to the bank for $${buildingProceeds}, paid to ${creditor.name}`
      : '';
  const interest =
    mortgageInterest > 0
      ? `${creditor.name} paid $${mortgageInterest} mortgage interest to the bank`
      : '';
  const details = [sold, interest].filter(Boolean).join('; ');
  const interestNote =
    mortgageInterest > 0 ? ` ${creditor.name} pays $${mortgageInterest} mortgage interest.` : '';
  return {
    players: players.map((p) => (p.id === creditor.id ? creditor : p)),
    assetsNote: `${creditor.name} receives their assets.${interestNote}`,
    logs: [
      `[Game] ${player.name}'s properties and cards went to ${creditor.name}${details ? `; ${details}` : ''}.`,
    ],
  };
};

type AuctionRemoval = RemovalNotes & {
  auction: AuctionState | null;
  players: Player[];
  resetPhase: boolean;
};

const auctionCancelled = (players: Player[], log: string): AuctionRemoval => ({
  auction: null,
  players,
  resetPhase: true,
  toast: ['Auction cancelled.'],
  logs: [log],
});

/** Awards `auction` to its one remaining bidder, who already holds the high bid. */
const awardToRemainingBidder = (
  auction: AuctionState,
  players: Player[],
  winnerId: string,
  propertyName: string
): AuctionRemoval => {
  const auctionWinner = players.find((p) => p.id === winnerId);
  if (!auctionWinner) return { auction: null, players, resetPhase: true, toast: [], logs: [] };
  const updatedWinner: Player = {
    ...auctionWinner,
    money: auctionWinner.money - auction.currentBid,
    properties: [...auctionWinner.properties, auction.propertyId],
  };
  return {
    auction: null,
    players: players.map((p) => (p.id === updatedWinner.id ? updatedWinner : p)),
    resetPhase: true,
    toast: [`${auctionWinner.name} won the auction for $${auction.currentBid}.`],
    logs: [`[${auctionWinner.name}] Won auction for ${propertyName} at $${auction.currentBid}.`],
  };
};

/** Keeps the bidder pointer on the same person after `leaverId` is dropped. */
const reseatBidder = (
  auction: AuctionState,
  participants: string[],
  leaverId: string
): AuctionState => {
  const removedBidderIndex = auction.participants.indexOf(leaverId);
  const shifted =
    removedBidderIndex < auction.currentBidderIndex
      ? auction.currentBidderIndex - 1
      : auction.currentBidderIndex;
  return { ...auction, participants, currentBidderIndex: shifted % participants.length };
};

/**
 * Settles an auction `playerId` is leaving. Cancels it when the leaver was the
 * high bidder or nobody is left, awards it to the sole remaining bidder when
 * that bidder already leads, and otherwise keeps it running with the bidder
 * pointer re-aligned. `resetPhase` is true whenever the auction ended.
 */
const removeFromAuction = (
  auction: AuctionState,
  players: Player[],
  player: Player
): AuctionRemoval => {
  const propertyName = BOARD.find((tile) => tile.id === auction.propertyId)?.name ?? 'the property';

  if (auction.highestBidderId === player.id) {
    return auctionCancelled(
      players,
      `[Game] Cancelled auction for ${propertyName} because ${player.name} left as the high bidder.`
    );
  }

  const participants = auction.participants.filter((id) => id !== player.id);
  if (participants.length === 0) {
    return auctionCancelled(
      players,
      `[Game] Auction for ${propertyName} was cancelled because no bidders remained.`
    );
  }

  if (participants.length === 1 && auction.highestBidderId === participants[0]) {
    return awardToRemainingBidder(auction, players, participants[0], propertyName);
  }

  return {
    auction: reseatBidder(auction, participants, player.id),
    players,
    resetPhase: false,
    toast: [],
    logs: [],
  };
};

/** Whose turn it is once `leaverIndex` (of `state.players`) is gone and they were up. */
const nextPlayerIdAfterRemoval = (
  state: GameState,
  players: Player[],
  leaverIndex: number
): string => {
  const nextId = state.players[(leaverIndex + 1) % state.players.length].id;
  return players.some((p) => p.id === nextId) ? nextId : players[0].id;
};

/** The pieces of a removal that change as its steps are applied in turn. */
interface RemovalDraft {
  players: Player[];
  phase: GameState['phase'];
  auction: AuctionState | null;
  activeTrade: TradeRequest | null;
  toast: string[];
  logs: string[];
}

const cancelTradeInvolving = (draft: RemovalDraft, player: Player): RemovalDraft => {
  const trade = draft.activeTrade;
  if (trade?.initiatorId !== player.id && trade?.targetPlayerId !== player.id) return draft;
  return {
    ...draft,
    activeTrade: null,
    toast: [...draft.toast, 'Active trade cancelled.'],
    logs: [...draft.logs, `[Game] Cancelled active trade because ${player.name} left.`],
  };
};

const leaveAuction = (draft: RemovalDraft, player: Player): RemovalDraft => {
  if (!draft.auction?.participants.includes(player.id)) return draft;
  const removal = removeFromAuction(draft.auction, draft.players, player);
  return {
    ...draft,
    auction: removal.auction,
    players: removal.players,
    phase: removal.resetPhase ? 'action' : draft.phase,
    toast: [...draft.toast, ...removal.toast],
    logs: [...draft.logs, ...removal.logs],
  };
};

/** Picks the next turn holder and winner once the player has been removed. */
const advanceAfterRemoval = (
  state: GameState,
  draft: RemovalDraft,
  player: Player,
  playerIndex: number,
  headline: string[]
): GameState => {
  const { players } = draft;
  let { phase, auction, activeTrade, toast, logs } = draft;
  let currentPlayerId = state.currentPlayerId;
  let doublesCount = state.doublesCount;
  let winner = state.winner;

  if (state.currentPlayerId === player.id) {
    currentPlayerId = nextPlayerIdAfterRemoval(state, players, playerIndex);
    phase = 'roll';
    doublesCount = 0;
  }

  if (players.length === 1) {
    winner = players[0].id;
    currentPlayerId = winner;
    phase = 'roll';
    doublesCount = 0;
    auction = null;
    activeTrade = null;
    toast = [...headline, `${players[0].name} wins!`];
    logs = [...logs, `[Game] ${players[0].name} wins!`];
  } else if (winner && !players.some((p) => p.id === winner)) {
    winner = null;
  }

  return {
    ...state,
    players,
    currentPlayerId,
    doublesCount,
    phase,
    winner,
    auction,
    activeTrade,
    errorMessage: undefined,
    toastMessage: toast.join(' '),
    logs,
  };
};

/**
 * The leaver's jail cards follow their assets: to the inheritor when there is
 * one (matching the counts in transferAssets), otherwise back into their decks.
 * Left untouched when they hold none, so states without the field stay as is.
 */
const releaseJailCards = (state: GameState, playerId: string, inheritorId?: string): GameState => {
  const holders = resolveJailCardHolders(state.players, state.jailCardHolders);
  const heldCount = jailDecksHeldBy(holders, playerId).length;
  if (heldCount === 0) return state;
  const heirsCards = inheritorId && state.players.some((p) => p.id === inheritorId);
  return {
    ...state,
    jailCardHolders: moveJailCards(holders, playerId, heirsCards ? inheritorId : null, heldCount),
  };
};

/** The state once the last player has been removed: nobody is left to play. */
const emptiedTable = (state: GameState, draft: RemovalDraft): GameState => ({
  ...state,
  players: [],
  currentPlayerId: '',
  doublesCount: 0,
  phase: 'roll',
  winner: null,
  auction: null,
  activeTrade: null,
  errorMessage: undefined,
  toastMessage: draft.toast.join(' '),
  logs: draft.logs,
});

/**
 * Shared cleanup for permanently removing a player mid-game: cancels any
 * trade or auction they're involved in (re-seating the auction winner if
 * they were the sole remaining bidder), advances the turn/win state, and
 * either hands their assets to `inheritorId` or — when there is none — drops
 * their tiles back to the unowned pool. `reason` only affects the toast/log
 * wording — the structural cleanup is identical whether the player left the
 * room or went bankrupt, so both paths share it (bankruptcy used to skip
 * this and leave a dangling activeTrade/auction reference). Only bankruptcy
 * to a player passes an `inheritorId`; leaving a room must never enrich
 * anyone.
 */
export const removePlayerAndCleanup = (
  state: GameState,
  playerId: string,
  reason: string,
  inheritorId?: string
): GameState => {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  const afterRemoval = releaseJailCards(state, playerId, inheritorId);
  const remaining = state.players
    .filter((p) => p.id !== playerId)
    // Debts owed to the departing player die with them.
    .map((p) => (p.debtOwedTo === playerId ? withoutDebt(p) : p));
  const inherited = giveAssetsToInheritor(player, remaining, inheritorId);
  const headline = [
    `${player.name} ${reason}.`,
    ...(inherited.assetsNote ? [inherited.assetsNote] : []),
  ];

  let draft: RemovalDraft = {
    players: inherited.players,
    phase: state.phase,
    auction: state.auction,
    activeTrade: state.activeTrade,
    toast: headline,
    logs: [...state.logs, `[${player.name}] ${reason}.`, ...inherited.logs],
  };
  draft = leaveAuction(cancelTradeInvolving(draft, player), player);

  if (draft.players.length > 0)
    return advanceAfterRemoval(afterRemoval, draft, player, playerIndex, headline);
  return emptiedTable(afterRemoval, draft);
};
