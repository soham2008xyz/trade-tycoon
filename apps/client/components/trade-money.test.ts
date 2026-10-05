import { describe, expect, it } from 'vitest';
import { moneyFromSlider, moneySliderMax, sliderFromMoney } from './trade-money';

describe('moneySliderMax', () => {
  it('counts whole steps for a round balance', () => {
    expect(moneySliderMax(1500)).toBe(150);
  });

  it('adds a last step for a balance between two multiples', () => {
    expect(moneySliderMax(1337)).toBe(134);
  });

  it('is 0 for no cash or a negative balance', () => {
    expect(moneySliderMax(0)).toBe(0);
    expect(moneySliderMax(-40)).toBe(0);
  });
});

describe('moneyFromSlider', () => {
  it('snaps to multiples of the step', () => {
    expect(moneyFromSlider(0, 1500)).toBe(0);
    expect(moneyFromSlider(57, 1500)).toBe(570);
  });

  it('reaches the exact balance on the last step', () => {
    expect(moneyFromSlider(134, 1337)).toBe(1337);
    expect(moneyFromSlider(133, 1337)).toBe(1330);
  });

  it('never exceeds a balance below one step', () => {
    expect(moneyFromSlider(1, 7)).toBe(7);
  });
});

describe('sliderFromMoney', () => {
  it('inverts moneyFromSlider for every position', () => {
    for (const max of [0, 7, 10, 1337, 1500]) {
      for (let position = 0; position <= moneySliderMax(max); position++) {
        expect(sliderFromMoney(moneyFromSlider(position, max), max)).toBe(position);
      }
    }
  });

  it('puts the full balance on the last step even when the nearest multiple is lower', () => {
    expect(sliderFromMoney(1334, 1334)).toBe(134);
  });
});
