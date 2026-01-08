import { GameState, Player } from './types';
import { BOARD, isTileBuyable } from './board-data';
import { createPlayer } from './game-setup';
import { processCardEffect } from './cards';
import { CHANCE_CARDS } from './chance-cards';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';

export type Action =
  | { type: 'JOIN_GAME'; playerId: string; name: string }
  | { type: 'ROLL_DICE'; playerId: string }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'BUY_PROPERTY'; playerId: string; propertyId: string }
  | { type: 'PAY_FINE'; playerId: string }
  | { type: 'USE_GOOJ_CARD'; playerId: string }
  | { type: 'DISMISS_ERROR' };

export const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'DISMISS_ERROR': {
      return { ...state, errorMessage: undefined };
    }

    case 'JOIN_GAME': {
      if (state.players.find((p) => p.id === action.playerId)) return state;
      const newPlayer = createPlayer(action.playerId, action.name);
      return {
        ...state,
        players: [...state.players, newPlayer],
        // If first player, set as current
        currentPlayerId: state.players.length === 0 ? newPlayer.id : state.currentPlayerId,
        errorMessage: undefined,
      };
    }

    case 'USE_GOOJ_CARD': {
      if (state.currentPlayerId !== action.playerId) return state;
      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];

      if (!player.isInJail) return state;
      if (player.getOutOfJailCards <= 0)
        return { ...state, errorMessage: "You don't have any Get Out of Jail Free cards." };

      const newPlayer = {
        ...player,
        isInJail: false,
        jailTurns: 0,
        getOutOfJailCards: player.getOutOfJailCards - 1,
      };
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      return {
        ...state,
        players: newPlayers,
        // Stay in roll phase to allow movement
        errorMessage: undefined,
      };
    }

    case 'PAY_FINE': {
      if (state.currentPlayerId !== action.playerId) return state;
      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];

      if (!player.isInJail) return state;
      if (player.money < 50)
        return { ...state, errorMessage: 'Insufficient funds to pay the fine.' };

      const newPlayer = { ...player, money: player.money - 50, isInJail: false, jailTurns: 0 };
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      return {
        ...state,
        players: newPlayers,
        // Stay in roll phase to allow movement
        errorMessage: undefined,
      };
    }

    case 'ROLL_DICE': {
      if (state.currentPlayerId !== action.playerId) return state;
      const canRollAgain = state.doublesCount > 0 && state.dice[0] === state.dice[1];
      if (state.phase !== 'roll' && !canRollAgain) return state;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const isDouble = die1 === die2;
      let newDoublesCount = isDouble ? state.doublesCount + 1 : 0;

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      let player = state.players[playerIndex];
      const wasInJail = player.isInJail;

      // Speeding Check
      if (newDoublesCount >= 3) {
        const newPlayers = [...state.players];
        newPlayers[playerIndex] = { ...player, position: 10, isInJail: true, jailTurns: 0 };
        return {
          ...state,
          dice: [die1, die2],
          doublesCount: 0,
          players: newPlayers,
          phase: 'action',
          errorMessage: undefined,
        };
      }

      // Jail Logic
      if (player.isInJail) {
        if (isDouble) {
          player = { ...player, isInJail: false, jailTurns: 0 };
          newDoublesCount = 0; // No extra turn after escaping
        } else {
          const turns = player.jailTurns + 1;
          if (turns >= 3) {
            player = { ...player, isInJail: false, jailTurns: 0, money: player.money - 50 };
            newDoublesCount = 0;
          } else {
            // Stay in Jail
            const newPlayers = [...state.players];
            newPlayers[playerIndex] = { ...player, jailTurns: turns };
            return {
              ...state,
              dice: [die1, die2],
              players: newPlayers,
              doublesCount: 0,
              phase: 'action',
              errorMessage: undefined,
            };
          }
        }
      }

      // Standard Move Logic (or Post-Jail Move)
      let newPosition = (player.position + die1 + die2) % 40;

      // Check if passed Go
      let money = player.money;
      if (newPosition < player.position) {
        money += 200;
      }

      let newPlayer = { ...player, position: newPosition, money };
      const newPlayers = [...state.players];
      // Update immediately so Chance logic works on current state
      newPlayers[playerIndex] = newPlayer;

      // Chance Logic
      let targetTile = BOARD[newPosition];
      if (targetTile.type === 'chance') {
        const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];

        const { player: updatedPlayer, sentToJail } = processCardEffect(newPlayer, card);
        newPlayer = updatedPlayer;

        if (sentToJail) {
          newDoublesCount = 0; // End turn if sent to jail
        }
        newPosition = newPlayer.position;

        // Update player with chance changes
        newPlayers[playerIndex] = newPlayer;
        // Update target tile for Rent Logic
        targetTile = BOARD[newPosition];
      }

      // Community Chest Logic
      if (targetTile.type === 'community_chest') {
        const card =
          COMMUNITY_CHEST_CARDS[Math.floor(Math.random() * COMMUNITY_CHEST_CARDS.length)];

        const { player: updatedPlayer, sentToJail } = processCardEffect(newPlayer, card);
        newPlayer = updatedPlayer;

        if (sentToJail) {
          newDoublesCount = 0; // End turn
        }
        newPosition = newPlayer.position;

        // Update player with chest changes
        newPlayers[playerIndex] = newPlayer;
        // Update target tile for Rent Logic (though mostly unrelated if it was a money card)
        targetTile = BOARD[newPosition];
      }

      // Go To Jail Tile Logic
      if (targetTile.type === 'go_to_jail') {
        newPlayer.position = 10;
        newPlayer.isInJail = true;
        newPlayer.jailTurns = 0;
        newPosition = 10;
        newPlayers[playerIndex] = newPlayer;
        targetTile = BOARD[newPosition]; // Update to Jail tile (though no rent on Jail)
        newDoublesCount = 0; // End turn
      }

      // Tax Logic
      if (targetTile.type === 'tax') {
        newPlayer.money -= targetTile.price || 0;
        newPlayers[playerIndex] = newPlayer;
      }

      // Rent Logic
      if (targetTile && targetTile.price && !newPlayer.isInJail) {
        // Don't pay rent if sent to jail
        const ownerIndex = newPlayers.findIndex(
          (p) => p.properties.includes(targetTile.id) && p.id !== newPlayer.id
        );
        if (ownerIndex !== -1) {
          const owner = newPlayers[ownerIndex];
          const rent = targetTile.rent ? targetTile.rent[0] : 0; // Simplified MVP Rent

          // Deduct from current player
          newPlayer.money -= rent;
          // Update current player in array again (since we modified local var)
          newPlayers[playerIndex] = newPlayer;

          // Pay owner
          const newOwner = { ...owner, money: owner.money + rent };
          newPlayers[ownerIndex] = newOwner;
        }
      }

      // Determine next phase based on where they landed
      // For MVP: allow End Turn or Buy

      return {
        ...state,
        dice: [die1, die2],
        doublesCount: newDoublesCount,
        players: newPlayers,
        phase: 'action', // Move to action phase
        errorMessage: undefined,
      };
    }

    case 'BUY_PROPERTY': {
      // Validate: Current player, Correct phase, Property is unowned, Player has money
      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];
      const tile = BOARD.find((t) => t.id === action.propertyId);

      if (!tile || !tile.price) return { ...state, errorMessage: 'Invalid property.' };

      if (!isTileBuyable(tile))
        return { ...state, errorMessage: 'This property cannot be bought.' };

      if (player.money < tile.price) return { ...state, errorMessage: 'Insufficient funds.' };

      // Check if owned
      const isOwned = state.players.some((p) => p.properties.includes(action.propertyId));
      if (isOwned) return { ...state, errorMessage: 'Property is already owned.' };

      const newPlayer = {
        ...player,
        money: player.money - tile.price,
        properties: [...player.properties, action.propertyId],
      };
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      return {
        ...state,
        players: newPlayers,
        // Stay in action phase until End Turn
        errorMessage: undefined,
      };
    }

    case 'END_TURN': {
      if (state.currentPlayerId !== action.playerId) return state;

      // Next player
      const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
      const nextIndex = (currentIndex + 1) % state.players.length;

      return {
        ...state,
        currentPlayerId: state.players[nextIndex].id,
        phase: 'roll',
        doublesCount: 0,
        errorMessage: undefined,
      };
    }

    default:
      return state;
  }
};
