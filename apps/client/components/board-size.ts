/**
 * Pure board sizing (NO React — see "File-extension discipline" in
 * apps/client/AGENTS.md). Shared by `Board` and the tablet layout, so the
 * layout can tell how much room the board leaves unused.
 */

/** Smallest board edge in px, even in a tiny frame. */
export const MIN_BOARD_SIZE = 320;
/** The board layout frames (phone board area, tablet root) pad 10px on each side. */
export const FRAME_PADDING = 10;
/**
 * Shortest strip worth showing below the board: about two player rows plus the
 * heading. Shorter than this, the list stays in the board centre.
 */
export const MIN_PLAYER_STRIP_HEIGHT = 140;

/**
 * Narrowest status panel beside the board in the phone layout's landscape
 * arrangement: room for the player chip, dice and two action buttons per row.
 */
export const MIN_SIDE_PANEL_WIDTH = 260;

/**
 * Edge of the square board in a frame of the given size. `minSize` defaults to
 * a floor that lets a 320px-wide portrait phone fill its width; a short
 * landscape frame passes a lower one so the board shrinks to fit (#288).
 */
export function getBoardSize(
  frameWidth: number,
  frameHeight: number,
  minSize: number = MIN_BOARD_SIZE
): number {
  return Math.max(minSize, Math.min(frameWidth, frameHeight) - 2 * FRAME_PADDING);
}

/**
 * Whether the phone layout puts the status panel beside the board rather than
 * in a bottom sheet. In a landscape phone viewport (web only; native locks to
 * portrait) a collapsed sheet leaves too little height for the board and hides
 * the action buttons (#288).
 */
export function isSideBySide(frameWidth: number, frameHeight: number): boolean {
  return frameWidth > frameHeight;
}

/**
 * Edge of the square board area in the side-by-side arrangement: the full
 * height, but narrow enough to leave the panel `MIN_SIDE_PANEL_WIDTH`, so a
 * near-square window does not squeeze the panel to a sliver.
 */
export function getSideBySideBoardArea(frameWidth: number, frameHeight: number): number {
  return Math.max(0, Math.min(frameHeight, frameWidth - MIN_SIDE_PANEL_WIDTH));
}

/**
 * Height left under the board in a tablet frame, or 0 when it is too short to
 * use. A tall frame (iPad portrait) leaves a strip; a wide one (landscape web)
 * leaves none, so the Players list stays in the board centre there.
 */
export function getPlayerStripHeight(frameWidth: number, frameHeight: number): number {
  const board = getBoardSize(frameWidth, frameHeight);
  const spare = frameHeight - board - 2 * FRAME_PADDING;
  return spare >= MIN_PLAYER_STRIP_HEIGHT ? spare : 0;
}
