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

/** Edge of the square board in a frame of the given size. */
export function getBoardSize(frameWidth: number, frameHeight: number): number {
  return Math.max(MIN_BOARD_SIZE, Math.min(frameWidth, frameHeight) - 2 * FRAME_PADDING);
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
