import { GameState, Player } from './types';
import { BOARD } from './board-data';
import { createPlayer } from './game-setup';
import { CHANCE_CARDS } from './chance-cards';

export type Action =
    | { type: 'JOIN_GAME', playerId: string, name: string }
    | { type: 'ROLL_DICE', playerId: string }
    | { type: 'END_TURN', playerId: string }
    | { type: 'BUY_PROPERTY', playerId: string, propertyId: string };

export const gameReducer = (state: GameState, action: Action): GameState => {
    switch (action.type) {
        case 'JOIN_GAME': {
            if (state.players.find(p => p.id === action.playerId)) return state;
            const newPlayer = createPlayer(action.playerId, action.name);
            return {
                ...state,
                players: [...state.players, newPlayer],
                // If first player, set as current
                currentPlayerId: state.players.length === 0 ? newPlayer.id : state.currentPlayerId
            };
        }

        case 'ROLL_DICE': {
            if (state.currentPlayerId !== action.playerId) return state;
            if (state.phase !== 'roll') return state; // Can only roll in 'roll' phase

            const die1 = Math.floor(Math.random() * 6) + 1;
            const die2 = Math.floor(Math.random() * 6) + 1;
            const isDouble = die1 === die2;

            const playerIndex = state.players.findIndex(p => p.id === action.playerId);
            const player = state.players[playerIndex];

            // Logic for Jail (Simplified for MVP)
            if (player.isInJail) {
                // ...
            }

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

                // console.log(`Chance: ${card.text}`); // Could add an event log to state later

                if (card.action.type === 'MONEY') {
                    newPlayer.money += card.action.amount;
                } else if (card.action.type === 'GO_TO_JAIL') {
                    newPlayer.position = 10; // Jail index
                    newPlayer.isInJail = true;
                    newPlayer.jailTurns = 0;
                    newPosition = 10;
                } else if (card.action.type === 'MOVE_TO') {
                    if (card.action.collectGo && card.action.position < newPosition) {
                        newPlayer.money += 200;
                    }
                    newPlayer.position = card.action.position;
                    newPosition = card.action.position;
                }

                // Update player with chance changes
                newPlayers[playerIndex] = newPlayer;
                // Update target tile for Rent Logic
                targetTile = BOARD[newPosition];
            }

            // Rent Logic
            if (targetTile && targetTile.price && !newPlayer.isInJail) { // Don't pay rent if sent to jail
                const ownerIndex = newPlayers.findIndex(p => p.properties.includes(targetTile.id) && p.id !== newPlayer.id);
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
                doublesCount: isDouble ? state.doublesCount + 1 : 0,
                players: newPlayers,
                phase: 'action', // Move to action phase
            };
        }

        case 'BUY_PROPERTY': {
            // Validate: Current player, Correct phase, Property is unowned, Player has money
            const playerIndex = state.players.findIndex(p => p.id === action.playerId);
            const player = state.players[playerIndex];
            const tile = BOARD.find(t => t.id === action.propertyId);

            if (!tile || !tile.price) return state;
            if (player.money < tile.price) return state;

            // Check if owned
            const isOwned = state.players.some(p => p.properties.includes(action.propertyId));
            if (isOwned) return state;

            const newPlayer = {
                ...player,
                money: player.money - tile.price,
                properties: [...player.properties, action.propertyId]
            };
            const newPlayers = [...state.players];
            newPlayers[playerIndex] = newPlayer;

            return {
                ...state,
                players: newPlayers,
                // Stay in action phase until End Turn
            };
        }

        case 'END_TURN': {
            if (state.currentPlayerId !== action.playerId) return state;

            // Next player
            const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId);
            const nextIndex = (currentIndex + 1) % state.players.length;

            return {
                ...state,
                currentPlayerId: state.players[nextIndex].id,
                phase: 'roll',
                doublesCount: 0,
            };
        }

        default:
            return state;
    }
};
