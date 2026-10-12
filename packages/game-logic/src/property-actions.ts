import type { Action, ActionOf, GameReducerResult } from './reducer-types';
import type { GameState, Player } from './types';
import { BOARD, isTileBuyable } from './board-data';
import { getBuildBlocker, getUnmortgageCost, validateEvenSell } from './helpers';
import { replacePlayerAt } from './player-update';
import { startAuction } from './auction-actions';

/**
 * Whether the active player may build, sell, mortgage or unmortgage in this
 * phase. Standard rules allow it at any point in your own turn, so the roll
 * phase counts too (#321): a player can mortgage to afford the jail fine, or
 * build before rolling. Only an open auction (and the unused 'end' phase)
 * blocks it.
 */
const canManageInPhase = (phase: GameState['phase']): boolean =>
  phase === 'roll' || phase === 'action';

/** `state` with `player` (at `playerIndex`) updated and the action announced and logged. */
const playerActed = (
  state: GameState,
  playerIndex: number,
  player: Player,
  toastMessage: string
): GameState => ({
  ...state,
  players: replacePlayerAt(state.players, playerIndex, player),
  toastMessage,
  errorMessage: undefined,
  logs: [...state.logs, `[${state.players[playerIndex].name}] ${toastMessage}`],
});

const buyProperty = (state: GameState, action: ActionOf<'BUY_PROPERTY'>): GameReducerResult => {
  // Validate: Current player, Correct phase, Property is unowned, Player has money
  if (state.currentPlayerId !== action.playerId) return state;
  if (state.phase !== 'action')
    return { ...state, errorMessage: 'Can only buy during action phase.' };

  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const tile = BOARD.find((t) => t.id === action.propertyId);

  if (!tile?.price) return { ...state, errorMessage: 'Invalid property.' };
  if (!isTileBuyable(tile)) return { ...state, errorMessage: 'This property cannot be bought.' };

  // Player must be standing on the property they are buying
  if (player.position !== tile.index)
    return { ...state, errorMessage: 'You must be on the property to buy it.' };
  if (player.money < tile.price) return { ...state, errorMessage: 'Insufficient funds.' };

  const isOwned = state.players.some((p) => p.properties.includes(action.propertyId));
  if (isOwned) return { ...state, errorMessage: 'Property is already owned.' };

  const bought = {
    ...player,
    money: player.money - tile.price,
    properties: [...player.properties, action.propertyId],
  };
  // Stay in action phase until End Turn
  return playerActed(state, playerIndex, bought, `Purchased ${tile.name} for $${tile.price}.`);
};

const declineBuy = (state: GameState, action: ActionOf<'DECLINE_BUY'>): GameReducerResult => {
  // Validate phase and turn
  if (state.currentPlayerId !== action.playerId) return state;
  if (state.phase !== 'action') return state;

  // Identify property player is on
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return state;

  const tile = BOARD[player.position];
  if (!isTileBuyable(tile)) return { ...state, errorMessage: 'Nothing to buy here.' };
  const isOwned = state.players.some((p) => p.properties.includes(tile.id));
  if (isOwned) return { ...state, errorMessage: 'Property is already owned.' };

  return startAuction(state, tile);
};

const buildHouse = (state: GameState, action: ActionOf<'BUILD_HOUSE'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  if (!canManageInPhase(state.phase))
    return { ...state, errorMessage: "Can't build during an auction." };
  if (state.doublesCount > 0)
    return { ...state, errorMessage: 'Cannot build while you have a pending double roll.' };

  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const tile = BOARD.find((t) => t.id === action.propertyId);

  const buildBlocker = getBuildBlocker(player, action.propertyId);
  if (buildBlocker) return { ...state, errorMessage: buildBlocker };
  // Unreachable (getBuildBlocker rejects tiles without a house cost); it narrows `tile`.
  if (!tile?.houseCost) return state;

  const currentHouses = player.houses[action.propertyId] || 0;
  const built = {
    ...player,
    money: player.money - tile.houseCost,
    houses: { ...player.houses, [action.propertyId]: currentHouses + 1 },
  };
  const toast = `Built a ${currentHouses === 4 ? 'Hotel' : 'House'} on ${tile.name}.`;
  return playerActed(state, playerIndex, built, toast);
};

const sellHouse = (state: GameState, action: ActionOf<'SELL_HOUSE'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  if (!canManageInPhase(state.phase))
    return { ...state, errorMessage: "Can't sell buildings during an auction." };

  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const tile = BOARD.find((t) => t.id === action.propertyId);

  if (!tile?.houseCost || !tile.group)
    return { ...state, errorMessage: 'Cannot sell from this property.' };
  if (!player.properties.includes(action.propertyId))
    return { ...state, errorMessage: 'You do not own this property.' };

  const currentHouses = player.houses[action.propertyId] || 0;
  if (currentHouses <= 0) return { ...state, errorMessage: 'No buildings to sell.' };
  // Even Sell Rule
  if (!validateEvenSell(player, action.propertyId))
    return { ...state, errorMessage: 'You must sell evenly across the color group.' };

  const refund = tile.houseCost / 2;
  const sold = {
    ...player,
    money: player.money + refund,
    houses: { ...player.houses, [action.propertyId]: currentHouses - 1 },
  };
  const toast = `Sold a ${currentHouses === 5 ? 'Hotel' : 'House'} on ${tile.name} for $${refund}.`;
  return playerActed(state, playerIndex, sold, toast);
};

const mortgageProperty = (
  state: GameState,
  action: ActionOf<'MORTGAGE_PROPERTY'>
): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  if (!canManageInPhase(state.phase))
    return { ...state, errorMessage: "Can't mortgage during an auction." };

  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const tile = BOARD.find((t) => t.id === action.propertyId);

  if (!tile) return { ...state, errorMessage: 'Invalid property.' };
  if (!tile.mortgageValue) return { ...state, errorMessage: 'This property cannot be mortgaged.' };
  if (!player.properties.includes(action.propertyId))
    return { ...state, errorMessage: 'You do not own this property.' };
  if (player.mortgaged.includes(action.propertyId))
    return { ...state, errorMessage: 'Property is already mortgaged.' };

  // Check for houses in the group (Must sell buildings first)
  const hasHouses =
    tile.group &&
    BOARD.filter((t) => t.group === tile.group).some((t) => (player.houses[t.id] || 0) > 0);
  if (hasHouses)
    return {
      ...state,
      errorMessage: 'You must sell all buildings in this color group before mortgaging.',
    };

  const mortgaged = {
    ...player,
    money: player.money + tile.mortgageValue,
    mortgaged: [...player.mortgaged, action.propertyId],
  };
  return playerActed(
    state,
    playerIndex,
    mortgaged,
    `Mortgaged ${tile.name} for $${tile.mortgageValue}.`
  );
};

const unmortgageProperty = (
  state: GameState,
  action: ActionOf<'UNMORTGAGE_PROPERTY'>
): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  if (!canManageInPhase(state.phase))
    return { ...state, errorMessage: "Can't unmortgage during an auction." };

  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const tile = BOARD.find((t) => t.id === action.propertyId);

  if (!tile) return { ...state, errorMessage: 'Invalid property.' };
  if (!tile.mortgageValue)
    return { ...state, errorMessage: 'This property cannot be unmortgaged.' };
  if (!player.properties.includes(action.propertyId))
    return { ...state, errorMessage: 'You do not own this property.' };
  if (!player.mortgaged.includes(action.propertyId))
    return { ...state, errorMessage: 'Property is not mortgaged.' };

  // Cost Calculation (Value + 10%)
  const cost = getUnmortgageCost(tile.mortgageValue);
  if (player.money < cost) return { ...state, errorMessage: `Insufficient funds. Cost: $${cost}` };

  const unmortgaged = {
    ...player,
    money: player.money - cost,
    mortgaged: player.mortgaged.filter((id) => id !== action.propertyId),
  };
  return playerActed(state, playerIndex, unmortgaged, `Unmortgaged ${tile.name} for $${cost}.`);
};

export const reducePropertyAction = (
  state: GameState,
  action: Action
): GameReducerResult | undefined => {
  switch (action.type) {
    case 'BUY_PROPERTY':
      return buyProperty(state, action);
    case 'DECLINE_BUY':
      return declineBuy(state, action);
    case 'BUILD_HOUSE':
      return buildHouse(state, action);
    case 'SELL_HOUSE':
      return sellHouse(state, action);
    case 'MORTGAGE_PROPERTY':
      return mortgageProperty(state, action);
    case 'UNMORTGAGE_PROPERTY':
      return unmortgageProperty(state, action);
    default:
      return undefined;
  }
};
