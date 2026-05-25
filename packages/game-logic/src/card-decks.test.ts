import { describe, it, expect } from 'vitest';
import { CHANCE_CARDS } from './chance-cards';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';

describe('card deck data', () => {
  const assertUniqueIds = (deckName: string, ids: string[]) => {
    expect(ids.length, `${deckName} should not be empty`).toBeGreaterThan(0);
    expect(new Set(ids).size, `${deckName} card ids should be unique`).toBe(ids.length);
  };

  it('chance deck has unique ids and valid required actions', () => {
    const ids = CHANCE_CARDS.map((card) => card.id);
    assertUniqueIds('chance', ids);

    expect(CHANCE_CARDS.some((card) => card.action.type === 'GO_TO_JAIL')).toBe(true);
    expect(CHANCE_CARDS.some((card) => card.action.type === 'GET_OUT_OF_JAIL')).toBe(true);
    expect(
      CHANCE_CARDS.some(
        (card) =>
          card.action.type === 'MOVE_TO' && card.action.position === 0 && card.action.collectGo === true
      )
    ).toBe(true);
  });

  it('community chest deck has unique ids and key action variety', () => {
    const ids = COMMUNITY_CHEST_CARDS.map((card) => card.id);
    assertUniqueIds('community chest', ids);

    expect(COMMUNITY_CHEST_CARDS.some((card) => card.action.type === 'REPAIRS')).toBe(true);
    expect(COMMUNITY_CHEST_CARDS.some((card) => card.action.type === 'COLLECT_FROM_ALL')).toBe(true);
    expect(COMMUNITY_CHEST_CARDS.some((card) => card.action.type === 'GO_TO_JAIL')).toBe(true);
  });

  it('all cards include non-empty text', () => {
    const allCards = [...CHANCE_CARDS, ...COMMUNITY_CHEST_CARDS];

    for (const card of allCards) {
      expect(card.text.trim().length).toBeGreaterThan(0);
    }
  });
});
