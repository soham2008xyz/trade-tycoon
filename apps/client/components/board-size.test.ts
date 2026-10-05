import { describe, expect, it } from 'vitest';
import { getBoardSize, getPlayerStripHeight, MIN_PLAYER_STRIP_HEIGHT } from './board-size';

describe('getBoardSize', () => {
  it('fits the shorter side minus the frame padding', () => {
    expect(getBoardSize(820, 1156)).toBe(800);
    expect(getBoardSize(1440, 900)).toBe(880);
  });

  it('never goes below the minimum', () => {
    expect(getBoardSize(200, 300)).toBe(320);
  });
});

describe('getPlayerStripHeight', () => {
  it('gives the unused height under the board on an iPad in portrait', () => {
    // iPad Air 11" is 820x1180 pt; the status-bar inset leaves about 1156.
    expect(getPlayerStripHeight(820, 1156)).toBe(1156 - 800 - 20);
  });

  it('is 0 on a landscape window, where the spare room is beside the board', () => {
    expect(getPlayerStripHeight(1440, 900)).toBe(0);
  });

  it('is 0 on a square frame', () => {
    expect(getPlayerStripHeight(800, 800)).toBe(0);
  });

  it('is 0 when the spare height is below the minimum', () => {
    // Board 780 + 20 padding leaves exactly MIN - 1.
    expect(getPlayerStripHeight(800, 800 + MIN_PLAYER_STRIP_HEIGHT - 1)).toBe(0);
  });

  it('shows a strip at exactly the minimum', () => {
    expect(getPlayerStripHeight(800, 800 + MIN_PLAYER_STRIP_HEIGHT)).toBe(MIN_PLAYER_STRIP_HEIGHT);
  });

  it('is 0 in a tiny frame where the minimum board overflows it', () => {
    expect(getPlayerStripHeight(300, 400)).toBe(0);
  });
});
