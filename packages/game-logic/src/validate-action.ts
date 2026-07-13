import type { GameAction, TradeOffer } from './types';

/**
 * Validates and narrows an untrusted payload into a `GameAction` before it
 * reaches the reducer. The server is the only caller that faces untrusted
 * input (local hotseat play constructs actions directly), but this lives in
 * game-logic so it stays a pure, dependency-free, unit-testable function
 * rather than pulling in a schema library for a small, fixed action surface.
 *
 * Returns `null` for anything malformed: wrong types, out-of-range numbers,
 * unknown action types, or extra/missing fields on a known type.
 */

const MAX_MONEY = 1_000_000_000;

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

const isSafeNonNegativeInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_MONEY;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((item) => typeof item === 'string');

const isTradeOffer = (v: unknown): v is TradeOffer => {
  if (!v || typeof v !== 'object') return false;
  const offer = v as Record<string, unknown>;
  return (
    isSafeNonNegativeInt(offer.money) &&
    isStringArray(offer.properties) &&
    isSafeNonNegativeInt(offer.getOutOfJailCards)
  );
};

export function parseGameAction(input: unknown): GameAction | null {
  if (!input || typeof input !== 'object') return null;
  const action = input as Record<string, unknown>;
  if (typeof action.type !== 'string') return null;

  switch (action.type) {
    case 'ROLL_DICE':
    case 'END_TURN':
    case 'PAY_FINE':
    case 'USE_GOOJ_CARD':
    case 'CONTINUE_TURN':
    case 'DECLARE_BANKRUPTCY':
    case 'DECLINE_BUY':
    case 'CONCEDE_AUCTION':
    case 'ACCEPT_TRADE':
    case 'REJECT_TRADE':
    case 'CANCEL_TRADE':
      if (!isNonEmptyString(action.playerId)) return null;
      return { type: action.type, playerId: action.playerId } as GameAction;

    case 'BUY_PROPERTY':
    case 'BUILD_HOUSE':
    case 'SELL_HOUSE':
    case 'MORTGAGE_PROPERTY':
    case 'UNMORTGAGE_PROPERTY':
      if (!isNonEmptyString(action.playerId) || !isNonEmptyString(action.propertyId)) return null;
      return {
        type: action.type,
        playerId: action.playerId,
        propertyId: action.propertyId,
      } as GameAction;

    case 'PLACE_BID':
      if (!isNonEmptyString(action.playerId) || !isSafeNonNegativeInt(action.amount)) return null;
      return { type: 'PLACE_BID', playerId: action.playerId, amount: action.amount };

    case 'PROPOSE_TRADE':
      if (
        !isNonEmptyString(action.playerId) ||
        !isNonEmptyString(action.targetPlayerId) ||
        !isTradeOffer(action.offer) ||
        !isTradeOffer(action.request)
      ) {
        return null;
      }
      return {
        type: 'PROPOSE_TRADE',
        playerId: action.playerId,
        targetPlayerId: action.targetPlayerId,
        offer: action.offer,
        request: action.request,
      };

    // JOIN_GAME and RESET_GAME are server-issued only and may never arrive
    // over the network from a player. DISMISS_ERROR / DISMISS_TOAST are
    // client-local UI concerns in multiplayer — accepting them online would
    // let any player clear a toast for the whole room (and amplify the
    // dismissal into a full-state broadcast), so they have no case here.
    default:
      return null;
  }
}
