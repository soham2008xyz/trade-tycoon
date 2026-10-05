import { describe, expect, it } from 'vitest';
import {
  getBoardSize,
  getPlayerStripHeight,
  getSideBySideBoardArea,
  isSideBySide,
  MIN_PLAYER_STRIP_HEIGHT,
  MIN_SIDE_PANEL_WIDTH,
} from './board-size';

describe('getBoardSize', () => {
  it('fits the shorter side minus the frame padding', () => {
    expect(getBoardSize(820, 1156)).toBe(800);
    expect(getBoardSize(1440, 900)).toBe(880);
  });

  it('never goes below the minimum', () => {
    expect(getBoardSize(200, 300)).toBe(320);
  });

  it('keeps a 320px portrait phone edge to edge', () => {
    expect(getBoardSize(320, 568)).toBe(320);
  });

  it('shrinks below the default floor when given a lower one', () => {
    // A landscape phone browser loses height to the URL bar.
    expect(getBoardSize(270, 270, 0)).toBe(250);
    expect(getBoardSize(10, 10, 0)).toBe(0);
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

describe('isSideBySide', () => {
  it('is true on a landscape phone', () => {
    expect(isSideBySide(568, 320)).toBe(true);
    expect(isSideBySide(844, 390)).toBe(true);
  });

  it('is false in portrait and on a square frame', () => {
    expect(isSideBySide(320, 568)).toBe(false);
    expect(isSideBySide(400, 400)).toBe(false);
  });
});

describe('getSideBySideBoardArea', () => {
  it('uses the full height when the panel keeps its minimum width', () => {
    expect(getSideBySideBoardArea(844, 390)).toBe(390);
  });

  it('narrows the board so the panel keeps its minimum width', () => {
    expect(getSideBySideBoardArea(568, 320)).toBe(568 - MIN_SIDE_PANEL_WIDTH);
    expect(getSideBySideBoardArea(599, 560)).toBe(599 - MIN_SIDE_PANEL_WIDTH);
  });

  it('is never negative', () => {
    expect(getSideBySideBoardArea(200, 100)).toBe(0);
  });
});
