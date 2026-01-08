import { GameState, Player } from './types';
import { BOARD } from './board-data';

export const createInitialState = (): GameState => {
  return {
    players: [],
    currentPlayerId: '',
    dice: [1, 1],
    doublesCount: 0,
    phase: 'roll', // Start ready to roll
    board: BOARD,
    winner: null,
  };
};

export const createPlayer = (id: string, name: string): Player => {
  return {
    id,
    name,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16), // Random hex color
    money: 1500,
    position: 0,
    isInJail: false,
    jailTurns: 0,
    properties: [],
    houses: {},
    mortgaged: [],
    getOutOfJailCards: 0,
  };
};
