export type PropertyGroup =
  | 'brown'
  | 'light_blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark_blue'
  | 'railroad'
  | 'utility';

export type TileType =
  | 'street'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'community_chest'
  | 'tax'
  | 'go'
  | 'jail'
  | 'parking'
  | 'go_to_jail';

export interface Tile {
  id: string;
  index: number; // 0-39
  name: string;
  type: TileType;
  description?: string;
  group?: PropertyGroup;
  price?: number;
  rent?: number[]; // [base, 1house, 2house, 3house, 4house, hotel] for streets. Flat rent for others.
  mortgageValue?: number;
  houseCost?: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  money: number;
  position: number;
  isInJail: boolean;
  jailTurns: number;
  properties: string[]; // List of Tile IDs
  houses: Record<string, number>; // propertyId -> number of houses (5 = hotel)
  mortgaged: string[]; // List of Tile IDs
  getOutOfJailCards: number;
  /**
   * Id of the player this player's negative balance is owed to. Set when a
   * player-to-player payment (rent, a "collect from every player" card) leaves
   * the balance below $0; absent for bank debts (tax, fines, repairs) and
   * whenever `money >= 0`. Read only by `DECLARE_BANKRUPTCY`, which hands the
   * bankrupt player's assets to this player instead of the bank.
   */
  debtOwedTo?: string;
}

export interface TradeOffer {
  money: number;
  properties: string[];
  getOutOfJailCards: number;
}

export interface TradeRequest {
  id: string;
  initiatorId: string;
  targetPlayerId: string;
  offer: TradeOffer;
  request: TradeOffer;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export interface AuctionState {
  propertyId: string;
  currentBid: number;
  highestBidderId: string | null;
  participants: string[]; // List of player IDs still in the auction
  currentBidderIndex: number;
}

/** The two decks that each contain exactly one Get Out of Jail Free card. */
export type JailCardDeck = 'chance' | 'communityChest';

/**
 * Who holds each deck's Get Out of Jail Free card; `null` means it is still in
 * the deck (and so can be drawn).
 */
export type JailCardHolders = Record<JailCardDeck, string | null>;

/**
 * Per-room turn limits, in milliseconds. `0` disables that timer. Snapshotted
 * into `GameState.timerConfig` when an online game starts so every client and
 * every server instance agree on the limits for the whole game.
 */
export interface TurnTimerConfig {
  /** Max time for one player's whole turn (roll, act, manage, end). */
  turnLimitMs: number;
  /** Max time for one bidder's chance to bid or pass in an auction. */
  auctionLimitMs: number;
}

/**
 * The running countdown. Exactly one is active at a time: the current player's
 * turn, or — while an auction is open — the current bidder's bid-or-pass.
 * Online only; hotseat never sets it.
 */
export interface TurnTimer {
  kind: 'turn' | 'auction';
  /** Whose clock this is (the current player, or the current bidder). */
  playerId: string;
  /**
   * Identity of what is being timed (see `getTimerSubject`). The deadline is
   * re-armed whenever it changes and left alone otherwise, so e.g. rolling
   * doubles or buying a property doesn't hand the player a fresh turn.
   */
  key: string;
  /** Authoritative expiry, epoch ms on the **server** clock. */
  deadline: number;
  /**
   * Wire only (added by the server's public serializer, never stored): ms left
   * when the snapshot was serialized. Lets a client with a skewed clock count
   * down correctly — see `localizeTurnTimer`.
   */
  remainingMs?: number;
  /**
   * Client only (added by `localizeTurnTimer`): the expiry on the **local**
   * clock, which is what a countdown should be drawn from.
   */
  expiresAt?: number;
}

export interface GameState {
  players: Player[];
  currentPlayerId: string;
  dice: [number, number];
  lastDiceRoll?: [number, number]; // To show history
  doublesCount: number; // To track speeding (3 doubles = jail)
  phase: 'roll' | 'action' | 'auction' | 'end'; // Game phase
  winner: string | null;
  auction: AuctionState | null;
  /**
   * Tile an auction has already been held for during the current landing.
   * A no-sale auction returns to the 'action' phase with the player still on
   * the unowned tile; this stops End Turn from auctioning it a second time.
   * Cleared when the player moves (ROLL_DICE) or the turn ends.
   */
  auctionedPropertyId?: string;
  /**
   * Which player holds each deck's Get Out of Jail Free card, so a held card is
   * never dealt a second time. `Player.getOutOfJailCards` stays the per-player
   * count (trades, the "Use Card" button); this says which deck each counted card
   * belongs to. Optional because rooms saved before it existed, and hand-built
   * fixtures, only carry counts — `resolveJailCardHolders` (jail-cards.ts) rebuilds
   * it from them, so always read it through that rather than directly.
   */
  jailCardHolders?: JailCardHolders;
  activeTrade: TradeRequest | null;
  /** Turn limits for this game; absent (old rooms, hotseat) means no timers. */
  timerConfig?: TurnTimerConfig;
  /** The running countdown, or null/absent when nothing is being timed. */
  timer?: TurnTimer | null;
  errorMessage?: string;
  toastMessage?: string;
  logs: string[];
}

export type GameAction =
  | { type: 'JOIN_GAME'; playerId: string; name: string }
  | { type: 'ROLL_DICE'; playerId: string; die1?: number; die2?: number }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'BUY_PROPERTY'; playerId: string; propertyId: string }
  | { type: 'PAY_FINE'; playerId: string }
  | { type: 'USE_GOOJ_CARD'; playerId: string }
  | { type: 'DISMISS_ERROR' }
  | { type: 'DISMISS_TOAST' }
  | { type: 'RESET_GAME'; players: { id: string; name: string; color: string }[] }
  | { type: 'CONTINUE_TURN'; playerId: string }
  | { type: 'BUILD_HOUSE'; playerId: string; propertyId: string }
  | { type: 'SELL_HOUSE'; playerId: string; propertyId: string }
  | { type: 'MORTGAGE_PROPERTY'; playerId: string; propertyId: string }
  | { type: 'UNMORTGAGE_PROPERTY'; playerId: string; propertyId: string }
  | { type: 'DECLARE_BANKRUPTCY'; playerId: string }
  | { type: 'DECLINE_BUY'; playerId: string }
  | { type: 'PLACE_BID'; playerId: string; amount: number }
  | { type: 'CONCEDE_AUCTION'; playerId: string }
  | {
      type: 'PROPOSE_TRADE';
      playerId: string;
      targetPlayerId: string;
      offer: TradeOffer;
      request: TradeOffer;
    }
  | { type: 'ACCEPT_TRADE'; playerId: string }
  | { type: 'REJECT_TRADE'; playerId: string }
  | { type: 'CANCEL_TRADE'; playerId: string };
