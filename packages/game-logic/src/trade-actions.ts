import {
  ACTION_REJECTED,
  type Action,
  type ActionOf,
  type GameReducerResult,
} from './reducer-types';
import type { GameState, Player, TradeOffer, TradeRequest } from './types';
import { resolveJailCardHolders, swapJailCards } from './jail-cards';
import { replacePlayerAt } from './player-update';

/**
 * Whether any of `propertyIds` has houses/hotel built on it, per `houses`.
 * Iterates `houses`' own entries and checks membership in `propertyIds`
 * (rather than indexing `houses[propId]` for each id) so this isn't a
 * dynamic-bracket-access read of a plain object keyed by data that
 * ultimately traces back to a network action (generic-object-injection).
 */
const hasHousesOnAny = (houses: Record<string, number>, propertyIds: string[]): boolean =>
  Object.entries(houses).some(([propId, count]) => count > 0 && propertyIds.includes(propId));

const isValidOfferAmounts = (offer: TradeOffer): boolean =>
  Number.isSafeInteger(offer.money) &&
  offer.money >= 0 &&
  Number.isSafeInteger(offer.getOutOfJailCards) &&
  offer.getOutOfJailCards >= 0;

/** Why `player` cannot give up `offer`, or `undefined` when they can. */
const offerShortfall = (
  player: Player,
  offer: TradeOffer
): 'money' | 'properties' | 'cards' | undefined => {
  if (player.money < offer.money) return 'money';
  if (!offer.properties.every((propId) => player.properties.includes(propId))) return 'properties';
  if (player.getOutOfJailCards < offer.getOutOfJailCards) return 'cards';
  return undefined;
};

/** Why the proposal cannot be made (offer side first, then request side), if it cannot. */
const proposalRejection = (
  initiator: Player,
  target: Player,
  action: ActionOf<'PROPOSE_TRADE'>
): string | undefined => {
  // Validate Initiator has offered items
  const offerShort = offerShortfall(initiator, action.offer);
  if (offerShort === 'money') return "You don't have enough money for this offer.";
  if (offerShort === 'properties') return "You don't own all offered properties.";
  if (offerShort === 'cards') return "You don't have enough GOOJ cards.";
  // Trading a developed property would orphan its houses (the receiving
  // player has no matching entry, and the seller's stale `houses` record
  // would keep counting toward flat costs like the Repairs card). Require
  // selling buildings back to the bank before the property can be traded.
  if (hasHousesOnAny(initiator.houses, action.offer.properties))
    return 'Sell buildings before trading a developed property.';

  // Validate Target (Request)
  const requestShort = offerShortfall(target, action.request);
  if (requestShort === 'money') return "Target doesn't have enough money.";
  if (requestShort === 'properties') return "Target doesn't own all requested properties.";
  if (requestShort === 'cards') return "Target doesn't have enough GOOJ cards.";
  if (hasHousesOnAny(target.houses, action.request.properties))
    return 'Target must sell buildings before trading a developed property.';
  return undefined;
};

const proposeTrade = (state: GameState, action: ActionOf<'PROPOSE_TRADE'>): GameReducerResult => {
  // Basic validation
  if (action.playerId === action.targetPlayerId)
    return { ...state, errorMessage: 'You cannot trade with yourself.' };
  if (!isValidOfferAmounts(action.offer) || !isValidOfferAmounts(action.request))
    return { ...state, errorMessage: 'Invalid trade amounts.' };

  const initiator = state.players.find((p) => p.id === action.playerId);
  const target = state.players.find((p) => p.id === action.targetPlayerId);
  if (!initiator || !target) return state;

  if (state.phase === 'auction') return { ...state, errorMessage: 'Cannot trade during auction.' };
  if (state.activeTrade)
    return { ...state, errorMessage: 'Resolve the current trade before proposing a new one.' };

  const rejection = proposalRejection(initiator, target, action);
  if (rejection) return { ...state, errorMessage: rejection };

  const tradeRequest: TradeRequest = {
    id: Date.now().toString(),
    initiatorId: action.playerId,
    targetPlayerId: action.targetPlayerId,
    offer: action.offer,
    request: action.request,
    status: 'pending',
  };

  return {
    ...state,
    activeTrade: tradeRequest,
    toastMessage: `${initiator.name} proposed a trade to ${target.name}.`,
    logs: [...state.logs, `[${initiator.name}] Proposed trade to ${target.name}.`],
  };
};

/** Why the accepting side of `trade` no longer holds up (checked at accept time), if it does not. */
const acceptRejection = (
  trade: TradeRequest,
  initiator: Player,
  target: Player
): string | undefined => {
  // Final Validation
  const offerShort = offerShortfall(initiator, trade.offer);
  if (offerShort === 'money') return 'Initiator no longer has funds.';
  if (offerShort === 'properties') return 'Initiator no longer owns properties.';
  if (offerShort === 'cards') return 'Initiator no longer has GOOJ cards.';

  const requestShort = offerShortfall(target, trade.request);
  if (requestShort === 'money') return "You don't have enough funds.";
  if (requestShort === 'properties') return "You don't own requested properties.";
  if (requestShort === 'cards') return "You don't have enough GOOJ cards.";

  // Re-check for houses built after the trade was proposed but before it
  // was accepted — the proposal-time check alone isn't enough.
  if (hasHousesOnAny(initiator.houses, trade.offer.properties))
    return 'Initiator has since built on an offered property.';
  if (hasHousesOnAny(target.houses, trade.request.properties))
    return 'You have since built on a requested property.';
  return undefined;
};

/**
 * `from` hands over `given` and receives `received`: money, properties (a
 * mortgaged one keeps its mortgage and moves with the property) and cards.
 * Returns both players after the swap.
 */
const swapAssets = (
  from: Player,
  to: Player,
  given: TradeOffer,
  received: TradeOffer
): { from: Player; to: Player } => {
  const movedMortgages = given.properties.filter((id) => from.mortgaged.includes(id));
  const receivedMortgages = received.properties.filter((id) => to.mortgaged.includes(id));
  return {
    from: {
      ...from,
      money: from.money - given.money + received.money,
      properties: [
        ...from.properties.filter((id) => !given.properties.includes(id)),
        ...received.properties,
      ],
      mortgaged: [
        ...from.mortgaged.filter((id) => !movedMortgages.includes(id)),
        ...receivedMortgages,
      ],
      getOutOfJailCards:
        from.getOutOfJailCards - given.getOutOfJailCards + received.getOutOfJailCards,
    },
    to: {
      ...to,
      money: to.money - received.money + given.money,
      properties: [
        ...to.properties.filter((id) => !received.properties.includes(id)),
        ...given.properties,
      ],
      mortgaged: [
        ...to.mortgaged.filter((id) => !receivedMortgages.includes(id)),
        ...movedMortgages,
      ],
      getOutOfJailCards:
        to.getOutOfJailCards - received.getOutOfJailCards + given.getOutOfJailCards,
    },
  };
};

const acceptTrade = (state: GameState, action: ActionOf<'ACCEPT_TRADE'>): GameReducerResult => {
  const trade = state.activeTrade;
  if (!trade) return state;
  if (trade.targetPlayerId !== action.playerId) return ACTION_REJECTED;

  const initiatorIndex = state.players.findIndex((p) => p.id === trade.initiatorId);
  const targetIndex = state.players.findIndex((p) => p.id === trade.targetPlayerId);
  if (initiatorIndex === -1 || targetIndex === -1) return { ...state, activeTrade: null };

  const initiator = state.players[initiatorIndex];
  const target = state.players[targetIndex];
  const rejection = acceptRejection(trade, initiator, target);
  if (rejection) return { ...state, errorMessage: rejection };

  const swapped = swapAssets(initiator, target, trade.offer, trade.request);
  // The counts above say how many cards moved; carry the matching decks'
  // cards along so they stay held (by their new owner) instead of re-entering play.
  const jailCardHolders = swapJailCards(
    resolveJailCardHolders(state.players, state.jailCardHolders),
    initiator.id,
    trade.offer.getOutOfJailCards,
    target.id,
    trade.request.getOutOfJailCards
  );

  return {
    ...state,
    players: replacePlayerAt(
      replacePlayerAt(state.players, initiatorIndex, swapped.from),
      targetIndex,
      swapped.to
    ),
    jailCardHolders,
    activeTrade: null,
    toastMessage: 'Trade completed!',
    logs: [...state.logs, `[Game] Trade completed between ${initiator.name} and ${target.name}.`],
  };
};

const closeTrade = (
  state: GameState,
  playerId: string,
  toast: string,
  verb: string
): GameState => ({
  ...state,
  activeTrade: null,
  toastMessage: toast,
  logs: [...state.logs, `[${state.players.find((p) => p.id === playerId)?.name}] ${verb} trade.`],
});

const rejectTrade = (state: GameState, action: ActionOf<'REJECT_TRADE'>): GameReducerResult => {
  if (!state.activeTrade) return state;
  if (state.activeTrade.targetPlayerId !== action.playerId) return state; // Only target can reject
  return closeTrade(state, action.playerId, 'Trade rejected.', 'Rejected');
};

const cancelTrade = (state: GameState, action: ActionOf<'CANCEL_TRADE'>): GameReducerResult => {
  if (!state.activeTrade) return state;
  if (state.activeTrade.initiatorId !== action.playerId) return ACTION_REJECTED;
  return closeTrade(state, action.playerId, 'Trade cancelled.', 'Cancelled');
};

export const reduceTradeAction = (
  state: GameState,
  action: Action
): GameReducerResult | undefined => {
  switch (action.type) {
    case 'PROPOSE_TRADE':
      return proposeTrade(state, action);
    case 'ACCEPT_TRADE':
      return acceptTrade(state, action);
    case 'REJECT_TRADE':
      return rejectTrade(state, action);
    case 'CANCEL_TRADE':
      return cancelTrade(state, action);
    default:
      return undefined;
  }
};
