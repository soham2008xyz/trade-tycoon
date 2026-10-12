import {
  ACTION_REJECTED,
  type Action,
  type ActionOf,
  type GameReducerResult,
  type Rng,
} from './reducer-types';
import type { GameState } from './types';
import { BOARD, isTileBuyable } from './board-data';
import { createPlayer } from './game-setup';
import { hasDuplicateColors, pickUnusedColor } from './player-colors';
import { jailDecksHeldBy, moveJailCards, resolveJailCardHolders } from './jail-cards';
import { bankruptcyCreditorId, removePlayerAndCleanup } from './player-removal';
import { replacePlayerAt } from './player-update';
import { reduceRollDice } from './roll-dice';
import { startAuction } from './auction-actions';

/**
 * Hands the turn to the next player in seat order. Shared by END_TURN and the
 * turn timer's forced skip so both reset the same per-turn fields.
 */
export const passTurn = (state: GameState, playerName?: string): GameState => {
  const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
  const nextIndex = (currentIndex + 1) % state.players.length;

  return {
    ...state,
    currentPlayerId: state.players[nextIndex].id,
    phase: 'roll',
    doublesCount: 0,
    auctionedPropertyId: undefined,
    errorMessage: undefined,
    toastMessage: undefined, // Clear any persisting messages
    logs: [...state.logs, `[${playerName ?? 'Player'}] Ended their turn.`],
  };
};

const resetGame = (state: GameState, action: ActionOf<'RESET_GAME'>): GameReducerResult => {
  if (action.players.length === 0) return ACTION_REJECTED;
  // Indistinguishable tokens/ownership dots; GameSetup also blocks this, but
  // the reducer is the backstop for any caller that bypasses the UI.
  if (hasDuplicateColors(action.players)) return ACTION_REJECTED;
  const newPlayers = action.players.map((p) => {
    const player = createPlayer(p.id, p.name);
    player.color = p.color;
    return player;
  });
  return {
    ...state,
    players: newPlayers,
    currentPlayerId: newPlayers[0].id,
    dice: [1, 1], // Reset dice
    lastDiceRoll: undefined,
    doublesCount: 0,
    phase: 'roll',
    winner: null,
    auction: null,
    auctionedPropertyId: undefined,
    jailCardHolders: undefined, // a fresh game has every jail card back in its deck
    activeTrade: null,
    errorMessage: undefined,
    toastMessage: undefined,
    logs: [],
  };
};

const joinGame = (state: GameState, action: ActionOf<'JOIN_GAME'>): GameReducerResult => {
  if (state.players.find((p) => p.id === action.playerId)) return state;
  const newPlayer = createPlayer(action.playerId, action.name);
  // `createPlayer` colors are random hex, which has no marker shape (#361);
  // a palette color keeps every joiner's color and shape distinct.
  newPlayer.color = pickUnusedColor(state.players);
  return {
    ...state,
    players: [...state.players, newPlayer],
    // If first player, set as current
    currentPlayerId: state.players.length === 0 ? newPlayer.id : state.currentPlayerId,
    errorMessage: undefined,
    toastMessage: undefined,
  };
};

const continueTurn = (state: GameState, action: ActionOf<'CONTINUE_TURN'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  // Only allow continue if doubles were rolled and not sent to jail (doublesCount > 0)
  if (state.doublesCount === 0) return state;
  return { ...state, phase: 'roll', errorMessage: undefined };
};

const useGoojCard = (state: GameState, action: ActionOf<'USE_GOOJ_CARD'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];

  if (!player.isInJail) return state;
  if (player.getOutOfJailCards <= 0)
    return { ...state, errorMessage: "You don't have any Get Out of Jail Free cards." };

  const freed = {
    ...player,
    isInJail: false,
    jailTurns: 0,
    getOutOfJailCards: player.getOutOfJailCards - 1,
  };

  // The used card goes back into its deck so it can be drawn again. A counted
  // card with no deck (old duplicate-draw state) is used up first instead.
  const holders = resolveJailCardHolders(state.players, state.jailCardHolders);
  const hasDeckless = player.getOutOfJailCards > jailDecksHeldBy(holders, player.id).length;

  const toastMessage = 'Used a "Get Out of Jail Free" card!';
  return {
    ...state,
    players: replacePlayerAt(state.players, playerIndex, freed),
    jailCardHolders: hasDeckless ? holders : moveJailCards(holders, player.id, null, 1),
    // Stay in roll phase to allow movement
    errorMessage: undefined,
    toastMessage,
    logs: [...state.logs, `[${player.name}] ${toastMessage}`],
  };
};

const payFine = (state: GameState, action: ActionOf<'PAY_FINE'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];

  if (!player.isInJail) return state;
  if (player.money < 50) return { ...state, errorMessage: 'Insufficient funds to pay the fine.' };

  const freed = { ...player, money: player.money - 50, isInJail: false, jailTurns: 0 };
  const toastMessage = 'Paid $50 fine to get out of jail.';
  return {
    ...state,
    players: replacePlayerAt(state.players, playerIndex, freed),
    // Stay in roll phase to allow movement
    errorMessage: undefined,
    toastMessage,
    logs: [...state.logs, `[${player.name}] ${toastMessage}`],
  };
};

const declareBankruptcy = (
  state: GameState,
  action: ActionOf<'DECLARE_BANKRUPTCY'>
): GameReducerResult => {
  const debtor = state.players.find((p) => p.id === action.playerId);
  if (!debtor) return state;
  // Delegate to the same removal cleanup `removePlayerFromGame` uses so
  // bankruptcy also cancels any trade/auction the player was part of
  // instead of leaving a dangling reference to a player who no longer
  // exists in state.players.
  return removePlayerAndCleanup(
    state,
    action.playerId,
    'went bankrupt',
    bankruptcyCreditorId(state, debtor)
  );
};

const endTurn = (state: GameState, action: ActionOf<'END_TURN'>): GameReducerResult => {
  if (state.currentPlayerId !== action.playerId) return state;
  // The turn can't end mid-auction. This also makes a repeated END_TURN
  // (sent again before the client sees the auction-start update) a no-op
  // instead of advancing the turn and orphaning the open auction.
  if (state.phase === 'auction') return state;

  const player = state.players.find((p) => p.id === action.playerId);
  if (player && player.money < 0) {
    return {
      ...state,
      errorMessage:
        'You cannot end your turn with negative funds. Sell, mortgage, or declare bankruptcy.',
    };
  }

  // Ending the turn on an unowned, buyable tile is a decline: the property
  // goes to auction (as DECLINE_BUY does) instead of silently staying out of
  // the game. The turn is kept; End Turn works again once the auction ends.
  // Only in the action phase (not before rolling, when the player may still
  // be standing on last turn's unsold tile), and not for a tile this landing
  // has already auctioned (a no-sale auction leaves it unowned).
  if (player && state.phase === 'action') {
    const tile = BOARD[player.position];
    if (
      isTileBuyable(tile) &&
      tile.id !== state.auctionedPropertyId &&
      !state.players.some((p) => p.properties.includes(tile.id))
    ) {
      return startAuction(state, tile);
    }
  }

  return passTurn(state, player?.name);
};

export const reduceTurnAction = (
  state: GameState,
  action: Action,
  rng: Rng
): GameReducerResult | undefined => {
  switch (action.type) {
    case 'RESET_GAME':
      return resetGame(state, action);
    case 'JOIN_GAME':
      return joinGame(state, action);
    case 'DISMISS_ERROR':
      return { ...state, errorMessage: undefined };
    case 'DISMISS_TOAST':
      return { ...state, toastMessage: undefined };
    case 'CONTINUE_TURN':
      return continueTurn(state, action);
    case 'USE_GOOJ_CARD':
      return useGoojCard(state, action);
    case 'PAY_FINE':
      return payFine(state, action);
    case 'ROLL_DICE':
      return reduceRollDice(state, action, rng);
    case 'DECLARE_BANKRUPTCY':
      return declareBankruptcy(state, action);
    case 'END_TURN':
      return endTurn(state, action);
    default:
      return undefined;
  }
};
