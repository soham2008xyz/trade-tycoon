export type PropertyGroup = 'brown' | 'light_blue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'dark_blue' | 'railroad' | 'utility';

export type TileType = 'street' | 'railroad' | 'utility' | 'chance' | 'community_chest' | 'tax' | 'go' | 'jail' | 'parking' | 'go_to_jail';

export interface Tile {
    id: string;
    index: number; // 0-39
    name: string;
    type: TileType;
    group?: PropertyGroup;
    price?: number;
    rent?: number[]; // [base, 1house, 2house, 3house, 4house, hotel] for streets. Flat rent for others.
    mortgageValue?: number;
    houseCost?: number;
}

export interface Player {
    id: string;
    name: string;
    color: string;
    money: number;
    position: number;
    isInJail: boolean;
    jailTurns: number;
    properties: string[]; // List of Tile IDs
    houses: Record<string, number>; // propertyId -> number of houses (5 = hotel)
    mortgaged: string[]; // List of Tile IDs
    getOutOfJailCards: number;
}

export interface GameState {
    players: Player[];
    currentPlayerId: string;
    dice: [number, number];
    lastDiceRoll?: [number, number]; // To show history
    doublesCount: number; // To track speeding (3 doubles = jail)
    phase: 'roll' | 'action' | 'end'; // Game phase
    board: Tile[]; // Static board data, but good to have accessible
    winner: string | null;
}
