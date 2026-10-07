import { describe, it, expect } from 'vitest';
import { getBoardBackAction } from './back-press';

describe('getBoardBackAction', () => {
  it('asks before leaving a game in progress', () => {
    expect(getBoardBackAction(false)).toBe('confirm-leave');
  });

  it('goes straight to the menu once the game is over', () => {
    expect(getBoardBackAction(true)).toBe('back-to-menu');
  });
});
