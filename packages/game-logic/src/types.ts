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

export interface GameState {
  players: Player[];
  currentPlayerId: string;
  dice: [number, number];
  lastDiceRoll?: [number, number]; // To show history
  doublesCount: number; // To track speeding (3 doubles = jail)
  phase: 'roll' | 'action' | 'auction' | 'end'; // Game phase
  board: Tile[]; // Static board data, but good to have accessible
  winner: string | null;
  auction: AuctionState | null;
  activeTrade: TradeRequest | null;
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
