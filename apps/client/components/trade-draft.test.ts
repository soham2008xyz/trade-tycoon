import { describe, expect, it } from 'vitest';
import { emptyOffer, stepCards, toggleProperty, withMoney } from './trade-draft';

describe('emptyOffer', () => {
  it('has nothing on it', () => {
    expect(emptyOffer()).toEqual({ money: 0, properties: [], getOutOfJailCards: 0 });
  });

  it('returns a new properties array each time', () => {
    expect(emptyOffer().properties).not.toBe(emptyOffer().properties);
  });
});

describe('withMoney', () => {
  it('sets the cash and keeps the rest', () => {
    const offer = { money: 0, properties: ['a'], getOutOfJailCards: 1 };
    expect(withMoney(offer, 250)).toEqual({ money: 250, properties: ['a'], getOutOfJailCards: 1 });
  });
});

describe('toggleProperty', () => {
  it('adds a property that is not on the side', () => {
    expect(toggleProperty(emptyOffer(), 'a').properties).toEqual(['a']);
  });

  it('keeps the order of earlier picks when adding', () => {
    const offer = { ...emptyOffer(), properties: ['a', 'b'] };
    expect(toggleProperty(offer, 'c').properties).toEqual(['a', 'b', 'c']);
  });

  it('removes a property that is already on the side', () => {
    const offer = { ...emptyOffer(), properties: ['a', 'b'] };
    expect(toggleProperty(offer, 'a').properties).toEqual(['b']);
  });

  it('does not mutate the input', () => {
    const offer = { ...emptyOffer(), properties: ['a'] };
    toggleProperty(offer, 'b');
    expect(offer.properties).toEqual(['a']);
  });
});

describe('stepCards', () => {
  const withCards = (getOutOfJailCards: number) => ({ ...emptyOffer(), getOutOfJailCards });

  it('adds one card', () => {
    expect(stepCards(withCards(0), 1, 2).getOutOfJailCards).toBe(1);
  });

  it('stops at the cards the player holds', () => {
    expect(stepCards(withCards(2), 1, 2).getOutOfJailCards).toBe(2);
  });

  it('removes one card', () => {
    expect(stepCards(withCards(2), -1, 2).getOutOfJailCards).toBe(1);
  });

  it('stops at zero', () => {
    expect(stepCards(withCards(0), -1, 2).getOutOfJailCards).toBe(0);
  });
});
