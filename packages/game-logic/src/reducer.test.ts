import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gameReducer } from './reducer';
import { createInitialState, createPlayer } from './index';
import { GameState } from './types';

describe('Game Reducer', () => {
    let initialState: GameState;

    beforeEach(() => {
        initialState = createInitialState();
    });

    it('should return initial state', () => {
        expect(initialState.players).toHaveLength(0);
        expect(initialState.phase).toBe('roll');
    });

    describe('JOIN_GAME', () => {
        it('should add a player', () => {
            const newState = gameReducer(initialState, {
                type: 'JOIN_GAME',
                playerId: 'p1',
                name: 'Player 1'
            });
            expect(newState.players).toHaveLength(1);
            expect(newState.players[0].id).toBe('p1');
            expect(newState.players[0].name).toBe('Player 1');
            expect(newState.currentPlayerId).toBe('p1');
        });

        it('should not add duplicate player', () => {
            let state = gameReducer(initialState, {
                type: 'JOIN_GAME',
                playerId: 'p1',
                name: 'Player 1'
            });
            state = gameReducer(state, {
                type: 'JOIN_GAME',
                playerId: 'p1',
                name: 'Player 1'
            });
            expect(state.players).toHaveLength(1);
        });

        it('should set first player as current player', () => {
             let state = gameReducer(initialState, {
                type: 'JOIN_GAME',
                playerId: 'p1',
                name: 'Player 1'
            });
             state = gameReducer(state, {
                type: 'JOIN_GAME',
                playerId: 'p2',
                name: 'Player 2'
            });
            expect(state.currentPlayerId).toBe('p1');
        });
    });

    describe('ROLL_DICE', () => {
        let stateWithPlayers: GameState;

        beforeEach(() => {
            stateWithPlayers = gameReducer(initialState, {
                type: 'JOIN_GAME',
                playerId: 'p1',
                name: 'Player 1'
            });
            stateWithPlayers = gameReducer(stateWithPlayers, {
                type: 'JOIN_GAME',
                playerId: 'p2',
                name: 'Player 2'
            });
        });

        it('should update position and change phase to action', () => {
            // Mock Math.random to return predictable dice rolls
            // 0.5 * 6 = 3 -> floor + 1 = 4
            const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

            const newState = gameReducer(stateWithPlayers, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            // 4 + 4 = 8
            expect(newState.dice).toEqual([4, 4]);
            expect(newState.players[0].position).toBe(8); // Started at 0
            expect(newState.phase).toBe('action');

            randomSpy.mockRestore();
        });

        it('should add money when passing GO', () => {
            // Set player near end of board (39 is Boardwalk, last square)
            stateWithPlayers.players[0].position = 38;

            // Roll 4 (2+2) -> 38 + 4 = 42 % 40 = 2
            const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.17); // 0.17 * 6 = 1.02 -> 2

            const newState = gameReducer(stateWithPlayers, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(2);
            expect(newState.players[0].money).toBe(1700); // 1500 + 200

            randomSpy.mockRestore();
        });

         it('should ignore roll if not current player', () => {
            const newState = gameReducer(stateWithPlayers, {
                type: 'ROLL_DICE',
                playerId: 'p2'
            });
            expect(newState).toBe(stateWithPlayers);
        });

        it('should ignore roll if not in roll phase', () => {
            stateWithPlayers.phase = 'action';
            const newState = gameReducer(stateWithPlayers, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });
            expect(newState).toBe(stateWithPlayers);
        });
    });

    describe('BUY_PROPERTY', () => {
        let stateForBuying: GameState;

        beforeEach(() => {
            stateForBuying = createInitialState();
            const player1 = createPlayer('p1', 'Player 1');
            stateForBuying.players = [player1];
            stateForBuying.currentPlayerId = 'p1';
            stateForBuying.phase = 'action';
        });

        it('should allow buying unowned property if enough money', () => {
            // Mediterranean Ave: id 'mediterranean', price 60
            const newState = gameReducer(stateForBuying, {
                type: 'BUY_PROPERTY',
                playerId: 'p1',
                propertyId: 'mediterranean'
            });

            expect(newState.players[0].money).toBe(1440); // 1500 - 60
            expect(newState.players[0].properties).toContain('mediterranean');
        });

        it('should fail if not enough money', () => {
            stateForBuying.players[0].money = 50;
            // Mediterranean Ave: price 60
             const newState = gameReducer(stateForBuying, {
                type: 'BUY_PROPERTY',
                playerId: 'p1',
                propertyId: 'mediterranean'
            });
             expect(newState.players[0].properties).not.toContain('mediterranean');
             expect(newState.players[0].money).toBe(50);
        });

        it('should fail if property already owned', () => {
             // Give it to p1 first
             let newState = gameReducer(stateForBuying, {
                type: 'BUY_PROPERTY',
                playerId: 'p1',
                propertyId: 'mediterranean'
            });

            // Try buy again
             newState = gameReducer(newState, {
                type: 'BUY_PROPERTY',
                playerId: 'p1',
                propertyId: 'mediterranean'
            });

            // Check didn't pay twice
            expect(newState.players[0].money).toBe(1440);
        });
    });

    describe('END_TURN', () => {
        let state: GameState;
         beforeEach(() => {
            state = createInitialState();
            state.players = [createPlayer('p1', 'Player 1'), createPlayer('p2', 'Player 2')];
            state.currentPlayerId = 'p1';
            state.phase = 'action';
        });

        it('should switch to next player and reset phase', () => {
            const newState = gameReducer(state, {
                type: 'END_TURN',
                playerId: 'p1'
            });

            expect(newState.currentPlayerId).toBe('p2');
            expect(newState.phase).toBe('roll');
        });

        it('should loop back to first player', () => {
            state.currentPlayerId = 'p2';
             const newState = gameReducer(state, {
                type: 'END_TURN',
                playerId: 'p2'
            });

            expect(newState.currentPlayerId).toBe('p1');
        });

         it('should ignore if not current player', () => {
            const newState = gameReducer(state, {
                type: 'END_TURN',
                playerId: 'p2'
            });

            expect(newState.currentPlayerId).toBe('p1');
        });
    });

    describe('Rent Payment', () => {
        let rentState: GameState;

        beforeEach(() => {
            rentState = createInitialState();
            const p1 = createPlayer('p1', 'Player 1');
            const p2 = createPlayer('p2', 'Player 2');

            // Give p2 a property (Mediterranean Ave, index 1, rent[0] = 2)
            p2.properties = ['mediterranean'];

            rentState.players = [p1, p2];
            rentState.currentPlayerId = 'p1';
            rentState.phase = 'roll';
        });

        it('should pay rent when landing on owned property', () => {
            // Roll 1 (0.5 -> 0, but forced to 1 via logic? No.
            // Dice logic: floor(random * 6) + 1.
            // To get 1 total is impossible with 2 dice (min 2).
            // Wait, Mediterranean is index 1. GO is 0.
            // Min roll is 2. So can't land on Mediterranean from GO.
            // Let's use Baltic Ave (index 3). Min roll 2 can't reach. Roll 3 (1+2).
            // Better: Move p1 to start at index 0. Target is Baltic (index 3).
            // Baltic Rent is 4.

            // Setup p2 owns Baltic
            rentState.players[1].properties = ['baltic'];

            // Mock roll 3 (1+2)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0); // 0 * 6 = 0 -> 1
            randomSpy.mockReturnValueOnce(0.17); // 0.17 * 6 = 1.02 -> 2
            // Total 3. Pos 0 -> 3.

            const newState = gameReducer(rentState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            // Baltic rent is 4.
            expect(newState.players[0].money).toBe(1496); // 1500 - 4
            expect(newState.players[1].money).toBe(1504); // 1500 + 4

            randomSpy.mockRestore();
        });

        it('should not pay rent if property is unowned', () => {
            // p1 lands on Baltic, but p2 doesn't own it
            rentState.players[1].properties = [];

             // Mock roll 3
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0);
            randomSpy.mockReturnValueOnce(0.17);

            const newState = gameReducer(rentState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].money).toBe(1500);
            expect(newState.players[1].money).toBe(1500);

            randomSpy.mockRestore();
        });

         it('should not pay rent if owned by self', () => {
            // p1 owns Baltic and lands on it
            rentState.players[0].properties = ['baltic'];
            rentState.players[1].properties = [];

             //HbMock roll 3
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0);
            randomSpy.mockReturnValueOnce(0.17);

            const newState = gameReducer(rentState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].money).toBe(1500);

            randomSpy.mockRestore();
        });
    });

    describe('Chance Logic', () => {
        let chanceState: GameState;

        beforeEach(() => {
            chanceState = createInitialState();
            const p1 = createPlayer('p1', 'Player 1');
            const p2 = createPlayer('p2', 'Player 2');
            chanceState.players = [p1, p2];
            chanceState.currentPlayerId = 'p1';
            chanceState.phase = 'roll';
        });

        it('should apply money card effect', () => {
            // Roll 7 (3+4) to land on Chance (index 7)
            // Card Index 1 (Bank error +200)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.4); // 0.4*6=2.4 -> 3
            randomSpy.mockReturnValueOnce(0.5); // 0.5*6=3.0 -> 4
            randomSpy.mockReturnValueOnce(0.15); // 0.15*8=1.2 -> 1

            const newState = gameReducer(chanceState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(7);
            expect(newState.players[0].money).toBe(1700); // 1500 + 200

            randomSpy.mockRestore();
        });

        it('should move player and pay rent', () => {
            // p2 owns Boardwalk (39)
            chanceState.players[1].properties = ['boardwalk'];

            // Roll 7 to Chance
            // Card Index 7 (Advance to Boardwalk)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.4); // 3
            randomSpy.mockReturnValueOnce(0.5); // 4
            randomSpy.mockReturnValueOnce(0.9); // 0.9*8=7.2 -> 7

            const newState = gameReducer(chanceState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(39);
            // Boardwalk Rent: 50
            expect(newState.players[0].money).toBe(1450); // 1500 - 50
            expect(newState.players[1].money).toBe(1550); // 1500 + 50

            randomSpy.mockRestore();
        });

        it('should go to jail', () => {
            // Roll 7 to Chance
            // Card Index 3 (Go to Jail)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.4); // 3
            randomSpy.mockReturnValueOnce(0.5); // 4
            randomSpy.mockReturnValueOnce(0.4); // 0.4*8=3.2 -> 3

            const newState = gameReducer(chanceState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(10);
            expect(newState.players[0].isInJail).toBe(true);

            randomSpy.mockRestore();
        });
    });

    describe('Pass Go Logic', () => {
        let goState: GameState;

        beforeEach(() => {
            goState = createInitialState();
            const p1 = createPlayer('p1', 'Player 1');
            goState.players = [p1];
            goState.currentPlayerId = 'p1';
            goState.phase = 'roll';
        });

        it('should collect $200 when passing Go normally', () => {
            goState.players[0].position = 38;
            // Roll 4 (2+2) -> 42 -> 2
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValue(0.17); // 2

            const newState = gameReducer(goState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(2);
            expect(newState.players[0].money).toBe(1700);

            randomSpy.mockRestore();
        });

        it('should collect $200 when landing on Go', () => {
            goState.players[0].position = 38;
            // Roll 2 (1+1) -> 40 -> 0
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValue(0); // 1

            const newState = gameReducer(goState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(0);
            expect(newState.players[0].money).toBe(1700);

            randomSpy.mockRestore();
        });

        it('should collect $200 via Advance to Go chance card', () => {
            // Start at 0. Roll 7 (3+4) -> 7 (Chance)
            // Card Index 0 (Advance to Go)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.4); // 3
            randomSpy.mockReturnValueOnce(0.5); // 4
            randomSpy.mockReturnValueOnce(0);   // Index 0

            const newState = gameReducer(goState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(0);
            expect(newState.players[0].money).toBe(1700);

            randomSpy.mockRestore();
        });

        it('should collect $400 if passed Go on roll AND via card', () => {
            goState.players[0].position = 35;
            // Roll 12 (6+6) -> 47 -> 7 (Chance) (Passed Go once)
            // Card Index 0 (Advance to Go) (Passed Go again)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.9); // 6
            randomSpy.mockReturnValueOnce(0.9); // 6
            randomSpy.mockReturnValueOnce(0);   // Index 0

            const newState = gameReducer(goState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(0);
            expect(newState.players[0].money).toBe(1900); // 1500 + 200 + 200

            randomSpy.mockRestore();
        });

        it('should NOT collect $200 when Going to Jail from Chance', () => {
            goState.players[0].position = 35;
            // Roll 12 (6+6) -> 47 -> 7 (Chance) (Passed Go once)
            // Card Index 3 (Go to Jail)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValueOnce(0.9); // 6
            randomSpy.mockReturnValueOnce(0.9); // 6
            randomSpy.mockReturnValueOnce(0.4); // Index 3 (Go to Jail)

            const newState = gameReducer(goState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(10);
            expect(newState.players[0].isInJail).toBe(true);
            expect(newState.players[0].money).toBe(1700); // 1500 + 200 (from roll) only

            randomSpy.mockRestore();
        });
    });

    describe('Tax Logic', () => {
        let taxState: GameState;

        beforeEach(() => {
            taxState = createInitialState();
            const p1 = createPlayer('p1', 'Player 1');
            taxState.players = [p1];
            taxState.currentPlayerId = 'p1';
            taxState.phase = 'roll';
        });

        it('should pay Income Tax ($200)', () => {
            taxState.players[0].position = 2; // Chest
            // Roll 2 (1+1) -> 4 (Income Tax)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValue(0); // 1

            const newState = gameReducer(taxState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(4);
            expect(newState.players[0].money).toBe(1300); // 1500 - 200

            randomSpy.mockRestore();
        });

        it('should pay Luxury Tax ($100)', () => {
            taxState.players[0].position = 36; // Chance
            // Roll 2 (1+1) -> 38 (Luxury Tax)
            const randomSpy = vi.spyOn(Math, 'random');
            randomSpy.mockReturnValue(0); // 1

            const newState = gameReducer(taxState, {
                type: 'ROLL_DICE',
                playerId: 'p1'
            });

            expect(newState.players[0].position).toBe(38);
            expect(newState.players[0].money).toBe(1400); // 1500 - 100

            randomSpy.mockRestore();
        });

        it('should NOT be able to buy Tax tiles', () => {
            taxState.phase = 'action';
            taxState.players[0].position = 4; // On Tax

            const newState = gameReducer(taxState, {
                type: 'BUY_PROPERTY',
                playerId: 'p1',
                propertyId: 'tax1'
            });

            expect(newState.players[0].money).toBe(1500);
            expect(newState.players[0].properties).toHaveLength(0);
        });
    });
});
