import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from './reducer';
import { GameState, Player } from './types';
import { BOARD } from './board-data';

const createMockState = (players: Player[]): GameState => ({
  players,
  currentPlayerId: players[0].id,
  dice: [1, 1],
  doublesCount: 0,
  phase: 'action',
  board: BOARD,
  winner: null,
  auction: null,
  activeTrade: null,
  logs: [],
});

const createPlayer = (id: string, name: string, money = 1500): Player => ({
  id,
  name,
  color: 'blue',
  money,
  position: 0,
  isInJail: false,
  jailTurns: 0,
  properties: [],
  houses: {},
  mortgaged: [],
  getOutOfJailCards: 0,
});

describe('Auction and Trade Logic', () => {
  let p1: Player;
  let p2: Player;
  let p3: Player;

  beforeEach(() => {
    p1 = createPlayer('p1', 'Player 1');
    p2 = createPlayer('p2', 'Player 2');
    p3 = createPlayer('p3', 'Player 3');
  });

  describe('Auction', () => {
    it('should start an auction when DECLINE_BUY is called', () => {
      // P1 is on Mediterranean Avenue (index 1)
      const state = createMockState([p1, p2]);
      state.players[0].position = 1;

      const newState = gameReducer(state, { type: 'DECLINE_BUY', playerId: 'p1' });

      expect(newState.phase).toBe('auction');
      expect(newState.auction).not.toBeNull();
      expect(newState.auction?.propertyId).toBe('mediterranean');
      expect(newState.auction?.participants).toHaveLength(2);
      expect(newState.auction?.participants).toContain('p1');
      expect(newState.auction?.participants).toContain('p2');
    });

    it('should allow bidding', () => {
      const state = createMockState([p1, p2]);
      state.phase = 'auction';
      state.auction = {
        propertyId: 'mediterranean',
        currentBid: 0,
        highestBidderId: null,
        participants: ['p1', 'p2'],
      };

      const newState = gameReducer(state, { type: 'PLACE_BID', playerId: 'p2', amount: 10 });

      expect(newState.auction?.currentBid).toBe(10);
      expect(newState.auction?.highestBidderId).toBe('p2');
    });

    it('should reject invalid bids', () => {
      const state = createMockState([p1, p2]);
      state.phase = 'auction';
      state.auction = {
        propertyId: 'mediterranean',
        currentBid: 50,
        highestBidderId: 'p2',
        participants: ['p1', 'p2'],
      };

      // Bid too low
      let newState = gameReducer(state, { type: 'PLACE_BID', playerId: 'p1', amount: 50 });
      expect(newState.errorMessage).toBe('Bid must be higher than current bid.');

      // Not enough money
      state.players[0].money = 40;
      newState = gameReducer(state, { type: 'PLACE_BID', playerId: 'p1', amount: 60 });
      expect(newState.errorMessage).toBe('Insufficient funds.');
    });

    it('should handle concessions correctly', () => {
      const state = createMockState([p1, p2, p3]);
      state.phase = 'auction';
      state.auction = {
        propertyId: 'mediterranean',
        currentBid: 0,
        highestBidderId: null,
        participants: ['p1', 'p2', 'p3'],
      };

      // P3 concedes
      let newState = gameReducer(state, { type: 'CONCEDE_AUCTION', playerId: 'p3' });
      expect(newState.auction?.participants).toHaveLength(2);
      expect(newState.auction?.participants).not.toContain('p3');

      // P1 bids
      newState = gameReducer(newState, { type: 'PLACE_BID', playerId: 'p1', amount: 10 });

      // P2 concedes -> P1 wins immediately
      newState = gameReducer(newState, { type: 'CONCEDE_AUCTION', playerId: 'p2' });

      expect(newState.phase).toBe('action');
      expect(newState.auction).toBeNull();
      expect(newState.players[0].properties).toContain('mediterranean');
      expect(newState.players[0].money).toBe(1490); // 1500 - 10
    });

    it('should allow last player to win by bidding if they were alone', () => {
       // Scenario: P1, P2. P2 concedes immediately without bidding.
       // P1 is left alone but hasn't bid.
       // P1 should be able to bid to win.
      const state = createMockState([p1, p2]);
      state.phase = 'auction';
      state.auction = {
        propertyId: 'mediterranean',
        currentBid: 0,
        highestBidderId: null,
        participants: ['p1', 'p2'],
      };

      let newState = gameReducer(state, { type: 'CONCEDE_AUCTION', playerId: 'p2' });
      // P1 is alone, not highest bidder yet.
      expect(newState.phase).toBe('auction');
      expect(newState.auction?.participants).toEqual(['p1']);

      // P1 bids 10 -> Wins immediately
      newState = gameReducer(newState, { type: 'PLACE_BID', playerId: 'p1', amount: 10 });

      expect(newState.phase).toBe('action');
      expect(newState.players[0].properties).toContain('mediterranean');
    });
  });

  describe('Trade', () => {
    it('should allow proposing a trade', () => {
      const state = createMockState([p1, p2]);
      p1.money = 500;
      p1.properties = ['mediterranean']; // owned

      const offer = { money: 100, properties: ['mediterranean'], getOutOfJailCards: 0 };
      const request = { money: 0, properties: [], getOutOfJailCards: 0 };

      const newState = gameReducer(createMockState([p1, p2]), {
        type: 'PROPOSE_TRADE',
        playerId: 'p1',
        targetPlayerId: 'p2',
        offer,
        request
      });

      expect(newState.activeTrade).not.toBeNull();
      expect(newState.activeTrade?.initiatorId).toBe('p1');
      expect(newState.activeTrade?.offer.money).toBe(100);
    });

    it('should validate assets at proposal', () => {
      const state = createMockState([p1, p2]);
      // P1 has 1500, no props

      const offer = { money: 2000, properties: [], getOutOfJailCards: 0 };
      const request = { money: 0, properties: [], getOutOfJailCards: 0 };

      const newState = gameReducer(state, {
        type: 'PROPOSE_TRADE',
        playerId: 'p1',
        targetPlayerId: 'p2',
        offer,
        request
      });

      expect(newState.activeTrade).toBeNull();
      expect(newState.errorMessage).toBe("You don't have enough money for this offer.");
    });

    it('should execute trade on accept', () => {
      p1.money = 1000;
      p2.money = 1000;
      p1.properties = ['mediterranean'];
      p2.properties = ['boardwalk'];
      const state = createMockState([p1, p2]);

      const offer = { money: 100, properties: ['mediterranean'], getOutOfJailCards: 0 };
      const request = { money: 50, properties: ['boardwalk'], getOutOfJailCards: 0 };

      // Set active trade manually
      state.activeTrade = {
        id: 'test',
        initiatorId: 'p1',
        targetPlayerId: 'p2',
        offer,
        request,
        status: 'pending'
      };

      const newState = gameReducer(state, { type: 'ACCEPT_TRADE', playerId: 'p2' });

      expect(newState.activeTrade).toBeNull();

      // Check P1
      expect(newState.players[0].money).toBe(1000 - 100 + 50); // 950
      expect(newState.players[0].properties).not.toContain('mediterranean');
      expect(newState.players[0].properties).toContain('boardwalk');

      // Check P2
      expect(newState.players[1].money).toBe(1000 - 50 + 100); // 1050
      expect(newState.players[1].properties).not.toContain('boardwalk');
      expect(newState.players[1].properties).toContain('mediterranean');
    });

    it('should transfer mortgaged status correctly during trade', () => {
        p1.money = 1000;
        p2.money = 1000;
        p1.properties = ['mediterranean'];
        p1.mortgaged = ['mediterranean']; // Mortgaged
        const state = createMockState([p1, p2]);

        const offer = { money: 0, properties: ['mediterranean'], getOutOfJailCards: 0 };
        const request = { money: 0, properties: [], getOutOfJailCards: 0 };

        // Set active trade manually
        state.activeTrade = {
          id: 'test',
          initiatorId: 'p1',
          targetPlayerId: 'p2',
          offer,
          request,
          status: 'pending'
        };

        const newState = gameReducer(state, { type: 'ACCEPT_TRADE', playerId: 'p2' });

        expect(newState.activeTrade).toBeNull();

        // P1 should not have it
        expect(newState.players[0].properties).not.toContain('mediterranean');
        expect(newState.players[0].mortgaged).not.toContain('mediterranean');

        // P2 should have it and it should be mortgaged
        expect(newState.players[1].properties).toContain('mediterranean');
        expect(newState.players[1].mortgaged).toContain('mediterranean');
    });

    it('should cancel trade', () => {
        const state = createMockState([p1, p2]);
        state.activeTrade = {
            id: 'test',
            initiatorId: 'p1',
            targetPlayerId: 'p2',
            offer: { money: 0, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
            status: 'pending'
        };

        const newState = gameReducer(state, { type: 'CANCEL_TRADE', playerId: 'p1' });
        expect(newState.activeTrade).toBeNull();
        expect(newState.toastMessage).toBe('Trade cancelled.');
    });

    it('should reject trade', () => {
        const state = createMockState([p1, p2]);
        state.activeTrade = {
            id: 'test',
            initiatorId: 'p1',
            targetPlayerId: 'p2',
            offer: { money: 0, properties: [], getOutOfJailCards: 0 },
            request: { money: 0, properties: [], getOutOfJailCards: 0 },
            status: 'pending'
        };

        const newState = gameReducer(state, { type: 'REJECT_TRADE', playerId: 'p2' });
        expect(newState.activeTrade).toBeNull();
        expect(newState.toastMessage).toBe('Trade rejected.');
    });
  });
});
