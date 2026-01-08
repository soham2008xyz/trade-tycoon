export const GREETING = "Hello from Game Logic";

export interface GameState {
    players: Player[];
    currentPlayerId: string;
}

export interface Player {
    id: string;
    name: string;
    money: number;
    position: number;
}

export const createInitialState = (): GameState => {
    return {
        players: [],
        currentPlayerId: ""
    };
};
