import { describe, expect, it, vi } from 'vitest';
import { createInitialState, createPlayer } from './index';
import { CHANCE_CARDS } from './chance-cards';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';
import { reduceGameAction, removePlayerFromGame, type Action, type Rng } from './reducer';
import type { GameState, Player } from './types';

// Each deck holds exactly one Get Out of Jail Free card, so at most one card per
// deck is in play and a held card cannot be drawn again until it is used.
const CHANCE_TILE_ROLL = { die1: 3, die2: 4 } as const; // 0 -> 7 (Chance)
const CHEST_TILE_ROLL = { die1: 1, die2: 1 } as const; // 0 -> 2 (Community Chest)

const CHANCE_JAIL_INDEX = CHANCE_CARDS.findIndex((c) => c.action.type === 'GET_OUT_OF_JAIL');
const CHEST_JAIL_INDEX = COMMUNITY_CHEST_CARDS.findIndex(
  (c) => c.action.type === 'GET_OUT_OF_JAIL'
);

/** An rng whose single draw selects index `index` of a deck of `length` cards. */
const picking =
  (index: number, length: number): Rng =>
  () =>
    (index + 0.5) / length;
const drawChanceJail = picking(CHANCE_JAIL_INDEX, CHANCE_CARDS.length);
const drawChestJail = picking(CHEST_JAIL_INDEX, COMMUNITY_CHEST_CARDS.length);
/** Always picks the last card of whatever pool it is handed. */
const drawLast: Rng = () => 0.999;

const newState = (): GameState => ({
  ...createInitialState(),
  players: [createPlayer('p1', 'P1'), createPlayer('p2', 'P2'), createPlayer('p3', 'P3')],
  currentPlayerId: 'p1',
});

const step = (state: GameState, action: Action, rng: Rng = Math.random): GameState => {
  const result = reduceGameAction(state, action, rng);
  if (typeof result === 'symbol') throw new Error(`action ${action.type} was rejected`);
  return result;
};

/** `playerId` rolls onto a Chance/Community Chest tile and draws with `rng`. */
const draw = (
  state: GameState,
  playerId: string,
  deck: 'chance' | 'chest',
  rng: Rng
): GameState => {
  const dice = deck === 'chance' ? CHANCE_TILE_ROLL : CHEST_TILE_ROLL;
  // Back to the start square so repeated draws by the same player land on the tile again.
  const reset: GameState = {
    ...state,
    currentPlayerId: playerId,
    phase: 'roll',
    doublesCount: 0,
    players: state.players.map((p) => (p.id === playerId ? { ...p, position: 0 } : p)),
  };
  return step(reset, { type: 'ROLL_DICE', playerId, ...dice }, rng);
};

const cards = (state: GameState, id: string): number =>
  state.players.find((p) => p.id === id)!.getOutOfJailCards;

const jail = (state: GameState, id: string): GameState => ({
  ...state,
  currentPlayerId: id,
  phase: 'roll',
  players: state.players.map((p): Player =>
    p.id === id ? { ...p, isInJail: true, position: 10 } : p
  ),
});

const useCard = (state: GameState, id: string): GameState =>
  step(jail(state, id), { type: 'USE_GOOJ_CARD', playerId: id });

describe('Get Out of Jail Free cards belong to a deck', () => {
  describe('drawing', () => {
    it('records who holds a deck’s card once it is drawn', () => {
      const after = draw(newState(), 'p1', 'chance', drawChanceJail);

      expect(cards(after, 'p1')).toBe(1);
      expect(after.jailCardHolders).toEqual({ chance: 'p1', communityChest: null });
    });

    it('never deals a held Chance jail card a second time', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      // p2's rng points at the jail card's slot; the card is out, so they get another.
      const after = draw(held, 'p2', 'chance', drawChanceJail);

      expect(cards(after, 'p2')).toBe(0);
      expect(cards(after, 'p1')).toBe(1);
      expect(after.jailCardHolders?.chance).toBe('p1');
      expect(after.toastMessage).not.toContain('Get Out of Jail Free');
    });

    it('does not let the same player draw their own held card again', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const after = draw(held, 'p1', 'chance', drawChanceJail);

      expect(cards(after, 'p1')).toBe(1);
    });

    it('never deals a held Community Chest jail card a second time', () => {
      const held = draw(newState(), 'p1', 'chest', drawChestJail);

      const after = draw(held, 'p1', 'chest', drawChestJail);

      expect(cards(after, 'p1')).toBe(1);
      expect(after.jailCardHolders).toEqual({ chance: null, communityChest: 'p1' });
    });

    it('treats the two decks independently', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const after = draw(held, 'p2', 'chest', drawChestJail);

      expect(cards(after, 'p1')).toBe(1);
      expect(cards(after, 'p2')).toBe(1);
      expect(after.jailCardHolders).toEqual({ chance: 'p1', communityChest: 'p2' });
    });

    it('lets one player hold both decks’ cards', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const after = draw(held, 'p1', 'chest', drawChestJail);

      expect(cards(after, 'p1')).toBe(2);
    });

    it('still deals every other card while the jail card is held', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);
      const seen = new Set<string>();

      for (let i = 0; i < CHANCE_CARDS.length - 1; i++) {
        const after = draw(held, 'p2', 'chance', picking(i, CHANCE_CARDS.length - 1));
        seen.add(after.toastMessage ?? '');
      }

      expect(seen.size).toBe(CHANCE_CARDS.length - 1);
    });

    it('consumes exactly one rng value per draw whether or not the jail card is held', () => {
      const rng = vi.fn(drawLast);
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      draw(newState(), 'p2', 'chance', rng);
      expect(rng).toHaveBeenCalledTimes(1);

      rng.mockClear();
      draw(held, 'p2', 'chance', rng);
      expect(rng).toHaveBeenCalledTimes(1);
    });
  });

  describe('using the card', () => {
    it('returns it to its deck so it can be drawn again', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const used = useCard(held, 'p1');
      expect(cards(used, 'p1')).toBe(0);
      expect(used.jailCardHolders?.chance).toBeNull();

      const redrawn = draw(used, 'p2', 'chance', drawChanceJail);
      expect(cards(redrawn, 'p2')).toBe(1);
      expect(redrawn.jailCardHolders?.chance).toBe('p2');
    });

    it('returns only one deck’s card when a player holds both', () => {
      let state = draw(newState(), 'p1', 'chance', drawChanceJail);
      state = draw(state, 'p1', 'chest', drawChestJail);

      const used = useCard(state, 'p1');

      expect(cards(used, 'p1')).toBe(1);
      const held = Object.values(used.jailCardHolders ?? {}).filter((id) => id === 'p1');
      expect(held).toHaveLength(1);
    });
  });

  describe('trading', () => {
    const propose = (state: GameState, offerCards: number, requestCards: number): GameState =>
      step(state, {
        type: 'PROPOSE_TRADE',
        playerId: 'p1',
        targetPlayerId: 'p2',
        offer: { money: 0, properties: [], getOutOfJailCards: offerCards },
        request: { money: 0, properties: [], getOutOfJailCards: requestCards },
      });
    const accept = (state: GameState): GameState =>
      step(state, { type: 'ACCEPT_TRADE', playerId: 'p2' });

    it('keeps a traded card held, now by its new owner', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const traded = accept(propose(held, 1, 0));

      expect(cards(traded, 'p1')).toBe(0);
      expect(cards(traded, 'p2')).toBe(1);
      expect(traded.jailCardHolders?.chance).toBe('p2');

      // Still out of the deck: nobody can draw it.
      const after = draw(traded, 'p3', 'chance', drawChanceJail);
      expect(cards(after, 'p3')).toBe(0);
    });

    it('moves the right deck’s card when both players hold one', () => {
      let state = draw(newState(), 'p1', 'chance', drawChanceJail);
      state = draw(state, 'p2', 'chest', drawChestJail);

      const traded = accept(propose(state, 1, 1));

      expect(traded.jailCardHolders).toEqual({ chance: 'p2', communityChest: 'p1' });
      expect(cards(traded, 'p1')).toBe(1);
      expect(cards(traded, 'p2')).toBe(1);
    });

    it('moves one deck’s card, leaving the other, when the owner holds both', () => {
      let state = draw(newState(), 'p1', 'chance', drawChanceJail);
      state = draw(state, 'p1', 'chest', drawChestJail);

      const traded = accept(propose(state, 1, 0));

      expect(cards(traded, 'p1')).toBe(1);
      expect(cards(traded, 'p2')).toBe(1);
      const holders = Object.values(traded.jailCardHolders ?? {});
      expect(holders.sort()).toEqual(['p1', 'p2']);
    });
  });

  describe('leaving the table', () => {
    const withDebt = (state: GameState): GameState => ({
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, money: -50, debtOwedTo: 'p2' } : p
      ),
    });

    it('goes to the creditor on bankruptcy and stays held', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const after = step(withDebt(held), { type: 'DECLARE_BANKRUPTCY', playerId: 'p1' });

      expect(cards(after, 'p2')).toBe(1);
      expect(after.jailCardHolders?.chance).toBe('p2');
      expect(cards(draw(after, 'p3', 'chance', drawChanceJail), 'p3')).toBe(0);
    });

    it('returns to the deck when the bankrupt player owes the bank', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);
      const owesBank: GameState = {
        ...held,
        players: held.players.map((p) => (p.id === 'p1' ? { ...p, money: -50 } : p)),
      };

      const after = step(owesBank, { type: 'DECLARE_BANKRUPTCY', playerId: 'p1' });

      expect(after.jailCardHolders?.chance).toBeNull();
      expect(cards(draw(after, 'p3', 'chance', drawChanceJail), 'p3')).toBe(1);
    });

    it('returns to the deck when the holder leaves the game', () => {
      const held = draw(newState(), 'p1', 'chance', drawChanceJail);

      const after = removePlayerFromGame(held, 'p1');

      expect(after.jailCardHolders?.chance).toBeNull();
      expect(cards(draw(after, 'p2', 'chance', drawChanceJail), 'p2')).toBe(1);
    });

    it('leaves other players’ cards alone when someone else leaves', () => {
      const held = draw(newState(), 'p2', 'chance', drawChanceJail);

      const after = removePlayerFromGame(held, 'p1');

      expect(after.jailCardHolders?.chance).toBe('p2');
    });
  });

  describe('older state without holder tracking', () => {
    // Rooms persisted before this change, and hand-built fixtures, carry only counts.
    const legacy = (counts: Record<string, number>): GameState => {
      const state = newState();
      delete state.jailCardHolders;
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, getOutOfJailCards: counts[p.id] ?? 0 })),
      };
    };

    it('infers that a counted card is held, so it cannot be drawn again', () => {
      // The count cannot say which deck the card came from; it is attributed to Chance first.
      const afterChance = draw(legacy({ p1: 1 }), 'p2', 'chance', drawChanceJail);
      expect(cards(afterChance, 'p2')).toBe(0);

      // The other deck's card is still in its deck.
      const afterChest = draw(afterChance, 'p2', 'chest', drawChestJail);
      expect(cards(afterChest, 'p2')).toBe(1);
    });

    it('lets a counted card be used without any holder record', () => {
      const used = useCard(legacy({ p1: 1 }), 'p1');

      expect(cards(used, 'p1')).toBe(0);
    });

    it('treats a player already holding both decks’ worth as blocking both decks', () => {
      const state = legacy({ p1: 2 });

      expect(cards(draw(state, 'p2', 'chance', drawChanceJail), 'p2')).toBe(0);
      expect(cards(draw(state, 'p2', 'chest', drawChestJail), 'p2')).toBe(0);
    });
  });

  it('is cleared when a new game is started', () => {
    const held = draw(newState(), 'p1', 'chance', drawChanceJail);

    const reset = step(held, {
      type: 'RESET_GAME',
      players: [
        { id: 'p1', name: 'P1', color: '#000' },
        { id: 'p2', name: 'P2', color: '#111' },
      ],
    });

    expect(cards(draw(reset, 'p2', 'chance', drawChanceJail), 'p2')).toBe(1);
  });
});
