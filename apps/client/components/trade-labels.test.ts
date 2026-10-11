import { describe, expect, it } from 'vitest';
import { cardStepLabel, goojCardsLabel, tradeColumnCopy } from './trade-labels';

describe('tradeColumnCopy', () => {
  it('names the offer column', () => {
    expect(tradeColumnCopy('offer')).toEqual({ heading: 'You Offer', verb: 'Offer' });
  });

  it('names the request column', () => {
    expect(tradeColumnCopy('request')).toEqual({ heading: 'You Request', verb: 'Request' });
  });
});

describe('cardStepLabel', () => {
  it('labels the offer steppers', () => {
    expect(cardStepLabel('offer', 'fewer')).toBe('Offer fewer Get Out of Jail Free cards');
    expect(cardStepLabel('offer', 'more')).toBe('Offer more Get Out of Jail Free cards');
  });

  it('labels the request steppers', () => {
    expect(cardStepLabel('request', 'fewer')).toBe('Request fewer Get Out of Jail Free cards');
    expect(cardStepLabel('request', 'more')).toBe('Request more Get Out of Jail Free cards');
  });
});

describe('goojCardsLabel', () => {
  it('shows the selected count out of the cards held', () => {
    expect(goojCardsLabel(1, 2)).toBe('GOOJ Cards (1/2)');
  });
});
