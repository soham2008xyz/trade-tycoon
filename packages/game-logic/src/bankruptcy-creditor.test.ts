import { describe, expect, it } from 'vitest';
import { createInitialState, createPlayer } from './index';
import { gameReducer, reduceGameAction, removePlayerFromGame } from './reducer';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';
import type { GameState, Player } from './types';

// Oriental Avenue rents: [6, 30, 90, 270, 400, 550]. From GO, dice 2+4 land on it
// (index 6) without rolling doubles, so the turn stays in the 'action' phase.
const ROLL_TO_ORIENTAL = { die1: 2, die2: 4 } as const;
// Income Tax is index 4: dice 1+3.
const ROLL_TO_TAX = { die1: 1, die2: 3 } as const;

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  ...createPlayer(id, `Player ${id.slice(1)}`),
  ...overrides,
});

/**
 * Issue #270: p3 owns Tennessee, p2 owns Oriental with 4 houses, p3 has $234
 * and is about to land on Oriental (rent $400), ending at -$166.
 */
const issueState = (): GameState => ({
  ...createInitialState(),
  players: [
    player('p1'),
    player('p2', {
      properties: ['oriental', 'vermont', 'connecticut'],
      houses: { oriental: 4, vermont: 4, connecticut: 4 },
    }),
    player('p3', { money: 234, properties: ['tennessee'] }),
  ],
  currentPlayerId: 'p3',
  phase: 'roll',
});

const byId = (state: GameState, id: string): Player => {
  const found = state.players.find((p) => p.id === id);
  if (!found) throw new Error(`player ${id} not in state`);
  return found;
};

const landOnOriental = (state: GameState): GameState =>
  gameReducer(state, { type: 'ROLL_DICE', playerId: 'p3', ...ROLL_TO_ORIENTAL });

describe('creditor tracking', () => {
  it('records the rent owner as creditor when rent pushes the payer below $0', () => {
    const after = landOnOriental(issueState());

    expect(byId(after, 'p3').money).toBe(234 - 400);
    expect(byId(after, 'p3').debtOwedTo).toBe('p2');
  });

  it('records no creditor when the payer can afford the rent', () => {
    const state = issueState();
    state.players[2].money = 1000;

    const after = landOnOriental(state);

    expect(byId(after, 'p3').money).toBe(600);
    expect(byId(after, 'p3').debtOwedTo).toBeUndefined();
  });

  it('records no creditor when the bank (tax) pushes a player below $0', () => {
    const state = issueState();
    state.players[2].money = 20;

    const after = gameReducer(state, { type: 'ROLL_DICE', playerId: 'p3', ...ROLL_TO_TAX });

    expect(byId(after, 'p3').money).toBeLessThan(0);
    expect(byId(after, 'p3').debtOwedTo).toBeUndefined();
  });

  it('keeps an existing creditor when a later bank payment deepens the debt', () => {
    // p3 already owes p2 and rolls again (doubles grant another roll while in 'action').
    const state = issueState();
    state.players[2].money = -50;
    state.players[2].debtOwedTo = 'p2';
    state.phase = 'action';
    state.doublesCount = 1;

    const after = gameReducer(state, {
      type: 'ROLL_DICE',
      playerId: 'p3',
      ...ROLL_TO_TAX,
    });

    expect(byId(after, 'p3').money).toBeLessThan(-50);
    expect(byId(after, 'p3').debtOwedTo).toBe('p2');
  });

  it('records the card drawer as creditor when a "collect from every player" card sinks someone', () => {
    const cardIndex = COMMUNITY_CHEST_CARDS.findIndex((c) => c.action.type === 'COLLECT_FROM_ALL');
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    const amount =
      COMMUNITY_CHEST_CARDS[cardIndex].action.type === 'COLLECT_FROM_ALL'
        ? COMMUNITY_CHEST_CARDS[cardIndex].action.amount
        : 0;

    const state = issueState();
    state.currentPlayerId = 'p1';
    state.players[2].money = amount - 10; // p3 cannot cover the card
    // Dice 1+1 land on Community Chest (index 2) from GO.
    const rng = () => (cardIndex + 0.5) / COMMUNITY_CHEST_CARDS.length;
    const result = reduceGameAction(
      state,
      { type: 'ROLL_DICE', playerId: 'p1', die1: 1, die2: 1 },
      rng
    );
    if (typeof result === 'symbol') throw new Error('rejected');

    expect(byId(result, 'p3').money).toBe(-10);
    expect(byId(result, 'p3').debtOwedTo).toBe('p1');
    // Players who could pay are not flagged.
    expect(byId(result, 'p2').debtOwedTo).toBeUndefined();
  });

  it('clears the creditor once the player is back at $0 or above', () => {
    const owing = landOnOriental(issueState());
    expect(byId(owing, 'p3').debtOwedTo).toBe('p2');

    // Mortgaging Tennessee ($90) is not enough: still in debt, creditor kept.
    const stillOwing = gameReducer(owing, {
      type: 'MORTGAGE_PROPERTY',
      playerId: 'p3',
      propertyId: 'tennessee',
    });
    expect(byId(stillOwing, 'p3').money).toBe(-166 + 90);
    expect(byId(stillOwing, 'p3').debtOwedTo).toBe('p2');

    // Raise more cash directly (stand-in for further sales) and the flag drops.
    const funded: GameState = {
      ...stillOwing,
      players: stillOwing.players.map((p) => (p.id === 'p3' ? { ...p, money: 5 } : p)),
    };
    const settled = gameReducer(funded, { type: 'DISMISS_TOAST' });
    expect(byId(settled, 'p3').debtOwedTo).toBeUndefined();
    expect('debtOwedTo' in byId(settled, 'p3')).toBe(false);
  });
});

describe('DECLARE_BANKRUPTCY with a player creditor', () => {
  it('transfers properties to the creditor (issue #270 scenario)', () => {
    const owing = landOnOriental(issueState());

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(byId(after, 'p2').properties).toContain('tennessee');
    expect(byId(after, 'p1').properties).not.toContain('tennessee');
    // Game continues with three -> two players, no winner yet.
    expect(after.winner).toBeNull();
  });

  it('keeps the mortgaged state of transferred properties', () => {
    const owing = landOnOriental(issueState());
    owing.players[2] = {
      ...owing.players[2],
      properties: ['tennessee', 'st_james'],
      mortgaged: ['st_james'],
    };

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(byId(after, 'p2').properties).toEqual(
      expect.arrayContaining(['tennessee', 'st_james', 'oriental'])
    );
    expect(byId(after, 'p2').mortgaged).toEqual(['st_james']);
  });

  it("sells the debtor's buildings back to the bank and gives the creditor the proceeds", () => {
    const owing = landOnOriental(issueState());
    // Orange set: 3 + 2 + 5 (hotel) buildings. Houses cost $100 each -> $50 refund each.
    owing.players[2] = {
      ...owing.players[2],
      properties: ['st_james', 'tennessee', 'new_york'],
      houses: { st_james: 3, tennessee: 2, new_york: 5 },
    };
    const creditorBefore = byId(owing, 'p2');

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    const creditor = byId(after, 'p2');
    // 10 buildings * $50 (half of the $100 build cost).
    expect(creditor.money).toBe(creditorBefore.money + 10 * 50);
    // No building follows the property: the transferred tiles arrive bare.
    for (const id of ['st_james', 'tennessee', 'new_york']) {
      expect(creditor.houses[id] ?? 0).toBe(0);
    }
    // The creditor's own buildings are untouched.
    expect(creditor.houses.oriental).toBe(4);
  });

  it("hands the debtor's Get Out of Jail Free cards to the creditor", () => {
    const owing = landOnOriental(issueState());
    owing.players[1] = { ...owing.players[1], getOutOfJailCards: 1 };
    owing.players[2] = { ...owing.players[2], getOutOfJailCards: 2 };

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(byId(after, 'p2').getOutOfJailCards).toBe(3);
    expect(byId(after, 'p1').getOutOfJailCards).toBe(0);
  });

  it('writes off the unpaid shortfall: the creditor keeps what was credited and is not charged', () => {
    const owing = landOnOriental(issueState());
    const creditorMoney = byId(owing, 'p2').money; // 1500 + full $400 rent
    expect(creditorMoney).toBe(1900);

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    // Tennessee has no buildings, so no extra cash either.
    expect(byId(after, 'p2').money).toBe(creditorMoney);
  });

  it('declares the creditor the winner when they are the last player left', () => {
    const state = issueState();
    state.players = [state.players[1], state.players[2]];
    const owing = landOnOriental(state);

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.winner).toBe('p2');
    expect(after.players).toHaveLength(1);
    expect(byId(after, 'p2').properties).toContain('tennessee');
    expect(after.toastMessage).toMatch(/Player 2 wins/);
  });

  it('mentions who inherits the assets in the toast and log', () => {
    const owing = landOnOriental(issueState());

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.toastMessage).toMatch(/Player 3 went bankrupt/);
    expect(after.toastMessage).toMatch(/Player 2/);
    expect(after.logs.join('\n')).toMatch(/Player 2/);
  });

  it('does not mutate the input state', () => {
    const owing = landOnOriental(issueState());
    const snapshot = JSON.stringify(owing);

    gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(JSON.stringify(owing)).toBe(snapshot);
  });

  it('keeps state JSON-serialisable', () => {
    const owing = landOnOriental(issueState());
    expect(JSON.parse(JSON.stringify(owing))).toEqual(owing);

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });

  it('still cancels trades and auctions the bankrupt player was in', () => {
    const owing = landOnOriental(issueState());
    owing.activeTrade = {
      id: 't',
      initiatorId: 'p3',
      targetPlayerId: 'p1',
      offer: { money: 0, properties: [], getOutOfJailCards: 0 },
      request: { money: 0, properties: [], getOutOfJailCards: 0 },
      status: 'pending',
    };

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.activeTrade).toBeNull();
  });
});

describe('DECLARE_BANKRUPTCY to the bank', () => {
  it('returns properties to the unowned pool when the debt came from tax', () => {
    const state = issueState();
    state.players[2].money = 20;
    state.players[2].mortgaged = [];
    const owing = gameReducer(state, { type: 'ROLL_DICE', playerId: 'p3', ...ROLL_TO_TAX });

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    const allOwned = after.players.flatMap((p) => p.properties);
    expect(allOwned).not.toContain('tennessee');
    expect(byId(after, 'p1').properties).toEqual([]);
    expect(byId(after, 'p2').money).toBe(1500);
    expect(byId(after, 'p2').getOutOfJailCards).toBe(0);
  });

  it('goes to the bank when declared while solvent (no outstanding debt)', () => {
    const state = issueState(); // p3 has $234 and no creditor

    const after = gameReducer(state, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.players.flatMap((p) => p.properties)).not.toContain('tennessee');
    expect(byId(after, 'p2').money).toBe(1500);
  });

  it('goes to the bank if the creditor is no longer in the game', () => {
    const owing = landOnOriental(issueState());
    owing.players[2] = { ...owing.players[2], debtOwedTo: 'ghost' };

    const after = gameReducer(owing, { type: 'DECLARE_BANKRUPTCY', playerId: 'p3' });

    expect(after.players.flatMap((p) => p.properties)).not.toContain('tennessee');
  });
});

describe('removePlayerFromGame (leaving the room)', () => {
  it("does not transfer a leaver's assets to their creditor", () => {
    const owing = landOnOriental(issueState());

    const after = removePlayerFromGame(owing, 'p3');

    expect(after.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(after.players.flatMap((p) => p.properties)).not.toContain('tennessee');
    expect(byId(after, 'p2').money).toBe(byId(owing, 'p2').money);
  });

  it('clears debts owed to a player who leaves, so nobody inherits via a stale id', () => {
    const owing = landOnOriental(issueState());

    const afterCreditorLeaves = removePlayerFromGame(owing, 'p2');

    expect(byId(afterCreditorLeaves, 'p3').debtOwedTo).toBeUndefined();
    // And a later bankruptcy by the debtor goes to the bank, not to the remaining player.
    const afterBankruptcy = gameReducer(afterCreditorLeaves, {
      type: 'DECLARE_BANKRUPTCY',
      playerId: 'p3',
    });
    expect(afterBankruptcy.players.flatMap((p) => p.properties)).not.toContain('tennessee');
  });
});
