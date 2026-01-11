import { GameState, Player, TradeOffer, TradeRequest } from './types';
import { BOARD, isTileBuyable } from './board-data';
import { createPlayer } from './game-setup';
import { processCardEffect } from './cards';
import { CHANCE_CARDS } from './chance-cards';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';
import { ownsCompleteGroup, validateEvenBuild, validateEvenSell } from './helpers';

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
  | { type: 'PROPOSE_TRADE'; playerId: string; targetPlayerId: string; offer: TradeOffer; request: TradeOffer }
  | { type: 'ACCEPT_TRADE'; playerId: string }
  | { type: 'REJECT_TRADE'; playerId: string }
  | { type: 'CANCEL_TRADE'; playerId: string };

export const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'RESET_GAME': {
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
        activeTrade: null,
        errorMessage: undefined,
        toastMessage: undefined,
        logs: [],
      };
    }

    case 'CONTINUE_TURN': {
      if (state.currentPlayerId !== action.playerId) return state;
      // Only allow continue if doubles were rolled and not sent to jail (doublesCount > 0)
      if (state.doublesCount === 0) return state;

      return {
        ...state,
        phase: 'roll',
        errorMessage: undefined,
      };
    }

    case 'DISMISS_ERROR': {
      return { ...state, errorMessage: undefined };
    }

    case 'DISMISS_TOAST': {
      return { ...state, toastMessage: undefined };
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
        toastMessage: undefined,
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

      const toastMessage = 'Used a "Get Out of Jail Free" card!';
      return {
        ...state,
        players: newPlayers,
        // Stay in roll phase to allow movement
        errorMessage: undefined,
        toastMessage,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
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

      const toastMessage = 'Paid $50 fine to get out of jail.';
      return {
        ...state,
        players: newPlayers,
        // Stay in roll phase to allow movement
        errorMessage: undefined,
        toastMessage,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'ROLL_DICE': {
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'roll') return state;

      const die1 = action.die1 ?? Math.floor(Math.random() * 6) + 1;
      const die2 = action.die2 ?? Math.floor(Math.random() * 6) + 1;

      const isDouble = die1 === die2;
      let newDoublesCount = isDouble ? state.doublesCount + 1 : 0;
      let toastMessage: string | undefined;

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      let player = state.players[playerIndex];
      const wasInJail = player.isInJail;

      // Speeding Check
      if (newDoublesCount >= 3) {
        const newPlayers = [...state.players];
        newPlayers[playerIndex] = { ...player, position: 10, isInJail: true, jailTurns: 0 };
        const toastMessage = 'Speeding! 3 doubles in a row. Go directly to Jail.';
        return {
          ...state,
          dice: [die1, die2],
          doublesCount: 0,
          players: newPlayers,
          phase: 'action',
          errorMessage: undefined,
          toastMessage,
          logs: [...state.logs, `[${player.name}] ${toastMessage}`],
        };
      }

      // Jail Logic
      if (player.isInJail) {
        if (isDouble) {
          player = { ...player, isInJail: false, jailTurns: 0 };
          newDoublesCount = 0; // No extra turn after escaping
          toastMessage = 'Rolled doubles! You are free from Jail.';
        } else {
          const turns = player.jailTurns + 1;
          if (turns >= 3) {
            player = { ...player, isInJail: false, jailTurns: 0, money: player.money - 50 };
            newDoublesCount = 0;
            toastMessage = 'Paid $50 fine after 3 turns in Jail.';
          } else {
            // Stay in Jail
            const newPlayers = [...state.players];
            newPlayers[playerIndex] = { ...player, jailTurns: turns };
            const toastMessage = 'Still in Jail.';
            return {
              ...state,
              dice: [die1, die2],
              players: newPlayers,
              doublesCount: 0,
              phase: 'action',
              errorMessage: undefined,
              toastMessage,
              logs: [...state.logs, `[${player.name}] ${toastMessage}`],
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
        toastMessage = toastMessage
          ? `${toastMessage} Passed GO! Collected $200.`
          : 'Passed GO! Collected $200.';
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

        if (card.action.type === 'COLLECT_FROM_ALL') {
          const amount = card.action.amount;
          let totalCollected = 0;
          newPlayers.forEach((p, i) => {
            if (p.id !== newPlayer.id) {
              const newMoney = p.money - amount;
              newPlayers[i] = { ...p, money: newMoney };
              totalCollected += amount;
            }
          });
          newPlayer.money += totalCollected;
        }

        const effectMsg = `Chance: ${card.text}`;
        toastMessage = toastMessage ? `${toastMessage} ${effectMsg}` : effectMsg;

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

        if (card.action.type === 'COLLECT_FROM_ALL') {
          const amount = card.action.amount;
          let totalCollected = 0;
          newPlayers.forEach((p, i) => {
            if (p.id !== newPlayer.id) {
              const newMoney = p.money - amount;
              newPlayers[i] = { ...p, money: newMoney };
              totalCollected += amount;
            }
          });
          newPlayer.money += totalCollected;
        }

        const effectMsg = `Community Chest: ${card.text}`;
        toastMessage = toastMessage ? `${toastMessage} ${effectMsg}` : effectMsg;

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
        toastMessage = 'Go to Jail!';
      }

      // Tax Logic
      if (targetTile.type === 'tax') {
        const taxAmount = targetTile.price || 0;
        newPlayer.money -= taxAmount;
        newPlayers[playerIndex] = newPlayer;
        const msg = `Paid $${taxAmount} in Tax.`;
        toastMessage = toastMessage ? `${toastMessage} ${msg}` : msg;
      }

      // Rent Logic
      if (targetTile && targetTile.price && !newPlayer.isInJail) {
        // Don't pay rent if sent to jail
        const ownerIndex = newPlayers.findIndex(
          (p) => p.properties.includes(targetTile.id) && p.id !== newPlayer.id
        );
        if (ownerIndex !== -1) {
          const owner = newPlayers[ownerIndex];
          let rent = 0;

          if (targetTile.group === 'railroad') {
            const boardToUse = state.board && state.board.length > 0 ? state.board : BOARD;

            const ownedRailroads = boardToUse.filter(
              (t) => t.group === 'railroad' && owner.properties.includes(t.id)
            ).length;
            // Rent is 25, 50, 100, 200 based on count (index 0-3)
            const rentIndex = Math.max(0, ownedRailroads - 1);
            rent = targetTile.rent ? targetTile.rent[rentIndex] : 25;
          } else if (targetTile.group === 'utility') {
            const boardToUse = state.board && state.board.length > 0 ? state.board : BOARD;
            const ownedUtilities = boardToUse.filter(
              (t) => t.group === 'utility' && owner.properties.includes(t.id)
            ).length;
            const multiplier = ownedUtilities === 2 ? 10 : 4;
            rent = (die1 + die2) * multiplier;
          } else if (targetTile.type === 'street') {
            const houseCount = owner.houses[targetTile.id] || 0;

            if (houseCount === 0 && targetTile.group && ownsCompleteGroup(owner, targetTile.group)) {
              // Double rent for unimproved complete set
              rent = (targetTile.rent ? targetTile.rent[0] : 0) * 2;
            } else {
              // Rent based on houses
              rent = targetTile.rent ? targetTile.rent[houseCount] : 0;
            }
          } else {
            rent = targetTile.rent ? targetTile.rent[0] : 0;
          }

          // If property is mortgaged, rent is 0
          if (owner.mortgaged.includes(targetTile.id)) {
            rent = 0;
          }

          // Deduct from current player
          newPlayer.money -= rent;
          // Update current player in array again (since we modified local var)
          newPlayers[playerIndex] = newPlayer;

          // Pay owner
          const newOwner = { ...owner, money: owner.money + rent };
          newPlayers[ownerIndex] = newOwner;

          const msg = `Paid $${rent} rent to ${owner.name}.`;
          toastMessage = toastMessage ? `${toastMessage} ${msg}` : msg;
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
        toastMessage,
        logs: toastMessage ? [...state.logs, `[${player.name}] ${toastMessage}`] : state.logs,
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

      const toastMessage = `Purchased ${tile.name} for $${tile.price}.`;
      return {
        ...state,
        players: newPlayers,
        // Stay in action phase until End Turn
        errorMessage: undefined,
        toastMessage,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'DECLINE_BUY': {
      // Validate phase and turn
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'action') return state;

      // Identify property player is on
      const player = state.players.find(p => p.id === action.playerId);
      if (!player) return state;

      const boardToUse = state.board && state.board.length > 0 ? state.board : BOARD;
      const tile = boardToUse[player.position];

      // Verify buyable
      if (!isTileBuyable(tile)) return { ...state, errorMessage: 'Nothing to buy here.' };
      // Check ownership
      const isOwned = state.players.some(p => p.properties.includes(tile.id));
      if (isOwned) return { ...state, errorMessage: 'Property is already owned.' };

      // Start Auction
      const participants = state.players.map(p => p.id);
      return {
        ...state,
        phase: 'auction',
        auction: {
          propertyId: tile.id,
          currentBid: 0,
          highestBidderId: null,
          participants
        },
        toastMessage: `Auction started for ${tile.name}!`,
        logs: [...state.logs, `[Game] Auction started for ${tile.name}.`]
      };
    }

    case 'PLACE_BID': {
      if (state.phase !== 'auction' || !state.auction) return state;
      if (!state.auction.participants.includes(action.playerId)) return { ...state, errorMessage: 'You are not in this auction.' };

      const player = state.players.find(p => p.id === action.playerId);
      if (!player) return state;

      if (action.amount <= state.auction.currentBid) return { ...state, errorMessage: 'Bid must be higher than current bid.' };
      if (player.money < action.amount) return { ...state, errorMessage: 'Insufficient funds.' };

      const updatedAuction = {
        ...state.auction,
        currentBid: action.amount,
        highestBidderId: action.playerId
      };

      // Check for immediate win (only 1 participant)
      if (updatedAuction.participants.length === 1) {
        const winnerId = action.playerId;
        const cost = action.amount;
        const tileId = state.auction.propertyId;
        const tile = BOARD.find(t => t.id === tileId);

        const winnerIndex = state.players.findIndex(p => p.id === winnerId);
        const winnerPlayer = state.players[winnerIndex];

        const newPlayer = {
          ...winnerPlayer,
          money: winnerPlayer.money - cost,
          properties: [...winnerPlayer.properties, tileId]
        };
        const newPlayers = [...state.players];
        newPlayers[winnerIndex] = newPlayer;

        return {
          ...state,
          players: newPlayers,
          phase: 'action',
          auction: null,
          toastMessage: `${winnerPlayer.name} won the auction for $${cost}!`,
          logs: [...state.logs, `[${winnerPlayer.name}] Won auction for ${tile?.name} at $${cost}.`]
        };
      }

      return {
        ...state,
        auction: updatedAuction,
        toastMessage: `${player.name} bid $${action.amount}.`,
        logs: [...state.logs, `[${player.name}] Bid $${action.amount}.`]
      };
    }

    case 'CONCEDE_AUCTION': {
      if (state.phase !== 'auction' || !state.auction) return state;
      if (!state.auction.participants.includes(action.playerId)) return state;

      // Cannot concede if you are the high bidder
      if (action.playerId === state.auction.highestBidderId) {
        return { ...state, errorMessage: "You cannot concede while you are the highest bidder." };
      }

      const newParticipants = state.auction.participants.filter(id => id !== action.playerId);
      const player = state.players.find(p => p.id === action.playerId);

      // If no one left, auction ends with no sale
      if (newParticipants.length === 0) {
        return {
          ...state,
          phase: 'action',
          auction: null,
          toastMessage: 'Auction cancelled. No bidders.',
          logs: [...state.logs, `[Game] Auction cancelled.`]
        };
      }

      // If 1 left
      if (newParticipants.length === 1) {
        const remainingId = newParticipants[0];
        // If the remaining player is the highest bidder, they win immediately
        if (remainingId === state.auction.highestBidderId) {
          const cost = state.auction.currentBid;
          const tileId = state.auction.propertyId;
          const tile = BOARD.find(t => t.id === tileId);

          const winnerIndex = state.players.findIndex(p => p.id === remainingId);
          const winnerPlayer = state.players[winnerIndex];

          const newPlayer = {
            ...winnerPlayer,
            money: winnerPlayer.money - cost,
            properties: [...winnerPlayer.properties, tileId]
          };
          const newPlayers = [...state.players];
          newPlayers[winnerIndex] = newPlayer;

          return {
            ...state,
            players: newPlayers,
            phase: 'action',
            auction: null,
            toastMessage: `${winnerPlayer.name} won the auction for $${cost}!`,
            logs: [...state.logs, `[${winnerPlayer.name}] Won auction for ${tile?.name} at $${cost}.`]
          };
        }
        // If remaining player is NOT high bidder (e.g. no bids yet), they stay in auction alone until they bid or concede
      }

      return {
        ...state,
        auction: { ...state.auction, participants: newParticipants },
        toastMessage: `${player?.name} conceded.`,
        logs: [...state.logs, `[${player?.name}] Conceded auction.`]
      };
    }

    case 'PROPOSE_TRADE': {
      // Basic validation
      const initiator = state.players.find(p => p.id === action.playerId);
      const target = state.players.find(p => p.id === action.targetPlayerId);
      if (!initiator || !target) return state;

      if (state.phase === 'auction') return { ...state, errorMessage: "Cannot trade during auction." };

      // Validate Initiator has offered items
      const hasMoney = initiator.money >= action.offer.money;
      const hasProps = action.offer.properties.every(propId => initiator.properties.includes(propId));
      const hasCards = initiator.getOutOfJailCards >= action.offer.getOutOfJailCards;

      if (!hasMoney) return { ...state, errorMessage: "You don't have enough money for this offer." };
      if (!hasProps) return { ...state, errorMessage: "You don't own all offered properties." };
      if (!hasCards) return { ...state, errorMessage: "You don't have enough GOOJ cards." };

      // We don't strictly validate target holdings yet, as they might change or user might just reject.
      // But typically UI should filter.

      const tradeRequest: TradeRequest = {
        id: Date.now().toString(),
        initiatorId: action.playerId,
        targetPlayerId: action.targetPlayerId,
        offer: action.offer,
        request: action.request,
        status: 'pending'
      };

      return {
        ...state,
        activeTrade: tradeRequest,
        toastMessage: `${initiator.name} proposed a trade to ${target.name}.`,
        logs: [...state.logs, `[${initiator.name}] Proposed trade to ${target.name}.`]
      };
    }

    case 'ACCEPT_TRADE': {
      if (!state.activeTrade) return state;
      if (state.activeTrade.targetPlayerId !== action.playerId) return { ...state, errorMessage: "This trade is not for you." };

      const trade = state.activeTrade;
      const initiatorIndex = state.players.findIndex(p => p.id === trade.initiatorId);
      const targetIndex = state.players.findIndex(p => p.id === trade.targetPlayerId);
      if (initiatorIndex === -1 || targetIndex === -1) return { ...state, activeTrade: null };

      const initiator = state.players[initiatorIndex];
      const target = state.players[targetIndex];

      // Final Validation
      // Initiator (Offer)
      if (initiator.money < trade.offer.money) return { ...state, errorMessage: "Initiator no longer has funds." };
      if (!trade.offer.properties.every(id => initiator.properties.includes(id))) return { ...state, errorMessage: "Initiator no longer owns properties." };
      if (initiator.getOutOfJailCards < trade.offer.getOutOfJailCards) return { ...state, errorMessage: "Initiator no longer has GOOJ cards." };

      // Target (Request)
      if (target.money < trade.request.money) return { ...state, errorMessage: "You don't have enough funds." };
      if (!trade.request.properties.every(id => target.properties.includes(id))) return { ...state, errorMessage: "You don't own requested properties." };
      if (target.getOutOfJailCards < trade.request.getOutOfJailCards) return { ...state, errorMessage: "You don't have enough GOOJ cards." };

      // Execute Trade
      let newInitiator = { ...initiator };
      let newTarget = { ...target };

      // Money
      newInitiator.money = newInitiator.money - trade.offer.money + trade.request.money;
      newTarget.money = newTarget.money - trade.request.money + trade.offer.money;

      // Properties Transfer
      // Offer (Initiator -> Target)
      newInitiator.properties = newInitiator.properties.filter(id => !trade.offer.properties.includes(id));
      newTarget.properties = [...newTarget.properties, ...trade.offer.properties];

      trade.offer.properties.forEach(propId => {
        if (newInitiator.mortgaged.includes(propId)) {
          newInitiator.mortgaged = newInitiator.mortgaged.filter(id => id !== propId);
          newTarget.mortgaged = [...newTarget.mortgaged, propId];
        }
      });

      // Request (Target -> Initiator)
      newTarget.properties = newTarget.properties.filter(id => !trade.request.properties.includes(id));
      newInitiator.properties = [...newInitiator.properties, ...trade.request.properties];

      trade.request.properties.forEach(propId => {
        if (newTarget.mortgaged.includes(propId)) {
            newTarget.mortgaged = newTarget.mortgaged.filter(id => id !== propId);
            newInitiator.mortgaged = [...newInitiator.mortgaged, propId];
        }
      });

      // GOOJ Cards
      newInitiator.getOutOfJailCards = newInitiator.getOutOfJailCards - trade.offer.getOutOfJailCards + trade.request.getOutOfJailCards;
      newTarget.getOutOfJailCards = newTarget.getOutOfJailCards - trade.request.getOutOfJailCards + trade.offer.getOutOfJailCards;

      const newPlayers = [...state.players];
      newPlayers[initiatorIndex] = newInitiator;
      newPlayers[targetIndex] = newTarget;

      return {
        ...state,
        players: newPlayers,
        activeTrade: null,
        toastMessage: "Trade completed!",
        logs: [...state.logs, `[Game] Trade completed between ${initiator.name} and ${target.name}.`]
      };
    }

    case 'REJECT_TRADE': {
      if (!state.activeTrade) return state;
      if (state.activeTrade.targetPlayerId !== action.playerId) return state; // Only target can reject

      return {
        ...state,
        activeTrade: null,
        toastMessage: "Trade rejected.",
        logs: [...state.logs, `[${state.players.find(p => p.id === action.playerId)?.name}] Rejected trade.`]
      };
    }

    case 'CANCEL_TRADE': {
      if (!state.activeTrade) return state;
      if (state.activeTrade.initiatorId !== action.playerId) return state; // Only initiator can cancel

      return {
        ...state,
        activeTrade: null,
        toastMessage: "Trade cancelled.",
        logs: [...state.logs, `[${state.players.find(p => p.id === action.playerId)?.name}] Cancelled trade.`]
      };
    }

    case 'BUILD_HOUSE': {
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'action') return { ...state, errorMessage: 'Can only build during action phase.' };
      if (state.doublesCount > 0) return { ...state, errorMessage: 'Cannot build while you have a pending double roll.' };

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];
      const tile = BOARD.find((t) => t.id === action.propertyId);

      if (!tile || !tile.houseCost || !tile.group) return { ...state, errorMessage: 'Cannot build on this property.' };

      // Ownership
      if (!player.properties.includes(action.propertyId)) return { ...state, errorMessage: 'You do not own this property.' };

      // Complete Group
      if (!ownsCompleteGroup(player, tile.group)) return { ...state, errorMessage: 'You must own the complete color group to build.' };

      // Max Houses
      const currentHouses = player.houses[action.propertyId] || 0;
      if (currentHouses >= 5) return { ...state, errorMessage: 'Max buildings reached.' };

      // Funds
      if (player.money < tile.houseCost) return { ...state, errorMessage: 'Insufficient funds.' };

      // Even Build Rule
      if (!validateEvenBuild(player, action.propertyId)) return { ...state, errorMessage: 'You must build evenly across the color group.' };

      // Execute
      const newHouses = { ...player.houses, [action.propertyId]: currentHouses + 1 };
      const newPlayer = {
        ...player,
        money: player.money - tile.houseCost,
        houses: newHouses,
      };

      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      const toastMessage = `Built a ${currentHouses === 4 ? 'Hotel' : 'House'} on ${tile.name}.`;
      return {
        ...state,
        players: newPlayers,
        toastMessage,
        errorMessage: undefined,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'SELL_HOUSE': {
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'action') return { ...state, errorMessage: 'Can only sell during action phase.' };
      // Standard rules allow selling at any time, but user said "build" during turn.
      // Assuming sell is also restricted to turn for simplicity, or at least action phase.

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];
      const tile = BOARD.find((t) => t.id === action.propertyId);

      if (!tile || !tile.houseCost || !tile.group) return { ...state, errorMessage: 'Cannot sell from this property.' };

      // Ownership
      if (!player.properties.includes(action.propertyId)) return { ...state, errorMessage: 'You do not own this property.' };

      // Has Houses
      const currentHouses = player.houses[action.propertyId] || 0;
      if (currentHouses <= 0) return { ...state, errorMessage: 'No buildings to sell.' };

      // Even Sell Rule
      if (!validateEvenSell(player, action.propertyId)) return { ...state, errorMessage: 'You must sell evenly across the color group.' };

      // Execute
      const newHouses = { ...player.houses, [action.propertyId]: currentHouses - 1 };
      const refund = tile.houseCost / 2;

      const newPlayer = {
        ...player,
        money: player.money + refund,
        houses: newHouses,
      };

      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      const toastMessage = `Sold a ${currentHouses === 5 ? 'Hotel' : 'House'} on ${tile.name} for $${refund}.`;
      return {
        ...state,
        players: newPlayers,
        toastMessage,
        errorMessage: undefined,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'MORTGAGE_PROPERTY': {
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'action') return { ...state, errorMessage: 'Can only mortgage during action phase.' };

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];
      const tile = BOARD.find((t) => t.id === action.propertyId);

      if (!tile) return { ...state, errorMessage: 'Invalid property.' };
      if (!tile.mortgageValue) return { ...state, errorMessage: 'This property cannot be mortgaged.' };

      // Ownership
      if (!player.properties.includes(action.propertyId)) return { ...state, errorMessage: 'You do not own this property.' };

      // Already Mortgaged
      if (player.mortgaged.includes(action.propertyId)) return { ...state, errorMessage: 'Property is already mortgaged.' };

      // Check for houses in the group (Must sell buildings first)
      if (tile.group) {
        const groupTiles = BOARD.filter((t) => t.group === tile.group);
        const hasHouses = groupTiles.some((t) => (player.houses[t.id] || 0) > 0);
        if (hasHouses) return { ...state, errorMessage: 'You must sell all buildings in this color group before mortgaging.' };
      }

      // Execute
      const newPlayer = {
        ...player,
        money: player.money + tile.mortgageValue,
        mortgaged: [...player.mortgaged, action.propertyId],
      };

      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      const toastMessage = `Mortgaged ${tile.name} for $${tile.mortgageValue}.`;
      return {
        ...state,
        players: newPlayers,
        toastMessage,
        errorMessage: undefined,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'UNMORTGAGE_PROPERTY': {
      if (state.currentPlayerId !== action.playerId) return state;
      if (state.phase !== 'action') return { ...state, errorMessage: 'Can only unmortgage during action phase.' };

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      const player = state.players[playerIndex];
      const tile = BOARD.find((t) => t.id === action.propertyId);

      if (!tile) return { ...state, errorMessage: 'Invalid property.' };
      if (!tile.mortgageValue) return { ...state, errorMessage: 'This property cannot be unmortgaged.' };

      // Ownership
      if (!player.properties.includes(action.propertyId)) return { ...state, errorMessage: 'You do not own this property.' };

      // Is Mortgaged
      if (!player.mortgaged.includes(action.propertyId)) return { ...state, errorMessage: 'Property is not mortgaged.' };

      // Cost Calculation (Value + 10%)
      const cost = Math.ceil(tile.mortgageValue * 1.1);
      if (player.money < cost) return { ...state, errorMessage: `Insufficient funds. Cost: $${cost}` };

      // Execute
      const newPlayer = {
        ...player,
        money: player.money - cost,
        mortgaged: player.mortgaged.filter((id) => id !== action.propertyId),
      };

      const newPlayers = [...state.players];
      newPlayers[playerIndex] = newPlayer;

      const toastMessage = `Unmortgaged ${tile.name} for $${cost}.`;
      return {
        ...state,
        players: newPlayers,
        toastMessage,
        errorMessage: undefined,
        logs: [...state.logs, `[${player.name}] ${toastMessage}`],
      };
    }

    case 'DECLARE_BANKRUPTCY': {
      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      if (playerIndex === -1) return state;
      const player = state.players[playerIndex];

      // Determine next player ID before removing the current one
      let nextPlayerId = state.currentPlayerId;
      let phase = state.phase;
      let doublesCount = state.doublesCount;

      if (state.currentPlayerId === action.playerId) {
        // If it's the bankrupt player's turn, pass turn to next player
        const nextIndex = (playerIndex + 1) % state.players.length;
        // If they are the only player left (should be caught by win condition, but logic holds),
        // next is them (but they are being removed).
        // Since we check length later, just get the ID.
        nextPlayerId = state.players[nextIndex].id;
        phase = 'roll';
        doublesCount = 0;
      }

      const newPlayers = state.players.filter((p) => p.id !== action.playerId);

      if (newPlayers.length === 0) {
        // Should not happen in normal game with >1 player, but handled
        return { ...state, players: [], winner: null };
      }

      if (newPlayers.length === 1) {
        return {
          ...state,
          players: newPlayers,
          winner: newPlayers[0].id,
          currentPlayerId: newPlayers[0].id,
          errorMessage: undefined,
          toastMessage: `${player.name} went bankrupt! ${newPlayers[0].name} wins!`,
          logs: [...state.logs, `[${player.name}] Declared Bankruptcy.`, `[Game] ${newPlayers[0].name} wins!`],
        };
      }

      return {
        ...state,
        players: newPlayers,
        currentPlayerId: nextPlayerId,
        phase,
        doublesCount,
        errorMessage: undefined,
        toastMessage: `${player.name} went bankrupt.`,
        logs: [...state.logs, `[${player.name}] Declared Bankruptcy.`],
      };
    }

    case 'END_TURN': {
      if (state.currentPlayerId !== action.playerId) return state;

      const player = state.players.find((p) => p.id === action.playerId);
      if (player && player.money < 0) {
        return {
          ...state,
          errorMessage: 'You cannot end your turn with negative funds. Sell, mortgage, or declare bankruptcy.',
        };
      }

      // Next player
      const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
      const nextIndex = (currentIndex + 1) % state.players.length;

      return {
        ...state,
        currentPlayerId: state.players[nextIndex].id,
        phase: 'roll',
        doublesCount: 0,
        errorMessage: undefined,
        toastMessage: undefined, // Clear any persisting messages
      };
    }

    default:
      return state;
  }
};
