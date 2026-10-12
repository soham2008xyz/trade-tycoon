import type { GameAction, TradeOffer } from './types';

/**
 * Validates and narrows an untrusted payload into a `GameAction` before it
 * reaches the reducer. The server is the only caller that faces untrusted
 * input (local hotseat play constructs actions directly), but this lives in
 * game-logic so it stays a pure, dependency-free, unit-testable function
 * rather than pulling in a schema library for a small, fixed action surface.
 *
 * Returns `null` for anything malformed: wrong types, out-of-range numbers,
 * unknown action types, or missing required fields on a known type. Extra,
 * unrecognized fields on an otherwise-valid action are silently dropped —
 * the returned object is rebuilt field-by-field from only what each case
 * expects, not passed through.
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

type RawAction = Record<string, unknown>;

// Action types are grouped by payload shape so each shape has one small parser.
// Keeping the switch to the unique shapes also keeps `parseGameAction` under the
// size/complexity limits Codacy (Lizard) enforces.
const PLAYER_ONLY_TYPES: ReadonlySet<string> = new Set([
  'ROLL_DICE',
  'END_TURN',
  'PAY_FINE',
  'USE_GOOJ_CARD',
  'CONTINUE_TURN',
  'DECLARE_BANKRUPTCY',
  'DECLINE_BUY',
  'CONCEDE_AUCTION',
  'ACCEPT_TRADE',
  'REJECT_TRADE',
  'CANCEL_TRADE',
]);

const PLAYER_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  'BUY_PROPERTY',
  'BUILD_HOUSE',
  'SELL_HOUSE',
  'MORTGAGE_PROPERTY',
  'UNMORTGAGE_PROPERTY',
]);

function parsePlayerOnlyAction(type: string, action: RawAction): GameAction | null {
  if (!isNonEmptyString(action.playerId)) return null;
  return { type, playerId: action.playerId } as GameAction;
}

function parsePlayerPropertyAction(type: string, action: RawAction): GameAction | null {
  if (!isNonEmptyString(action.playerId) || !isNonEmptyString(action.propertyId)) return null;
  return { type, playerId: action.playerId, propertyId: action.propertyId } as GameAction;
}

function parsePlaceBid(action: RawAction): GameAction | null {
  if (!isNonEmptyString(action.playerId) || !isSafeNonNegativeInt(action.amount)) return null;
  return { type: 'PLACE_BID', playerId: action.playerId, amount: action.amount };
}

function parseProposeTrade(action: RawAction): GameAction | null {
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
}

export function parseGameAction(input: unknown): GameAction | null {
  if (!input || typeof input !== 'object') return null;
  const action = input as RawAction;
  const { type } = action;
  if (typeof type !== 'string') return null;

  if (PLAYER_ONLY_TYPES.has(type)) return parsePlayerOnlyAction(type, action);
  if (PLAYER_PROPERTY_TYPES.has(type)) return parsePlayerPropertyAction(type, action);

  switch (type) {
    case 'PLACE_BID':
      return parsePlaceBid(action);
    case 'PROPOSE_TRADE':
      return parseProposeTrade(action);

    // JOIN_GAME and RESET_GAME are server-issued only and may never arrive
    // over the network from a player. DISMISS_ERROR / DISMISS_TOAST are
    // client-local UI concerns in multiplayer — accepting them online would
    // let any player clear a toast for the whole room (and amplify the
    // dismissal into a full-state broadcast), so they have no case here.
    default:
      return null;
  }
}
