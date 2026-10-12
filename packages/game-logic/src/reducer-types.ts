import type { GameState, TradeOffer } from './types';

export type Action =
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

/** The variant of `Action` whose `type` is `T`. */
export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;

export const ACTION_REJECTED = Symbol('ACTION_REJECTED');
export type ActionRejected = typeof ACTION_REJECTED;
export type GameReducerResult = GameState | ActionRejected;

/** Returns a number in [0, 1), same contract as `Math.random`. */
export type Rng = () => number;
