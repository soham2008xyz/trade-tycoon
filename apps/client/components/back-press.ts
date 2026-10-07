/** What the Android hardware Back button does on the game board. */
export type BoardBackAction = 'confirm-leave' | 'back-to-menu';

/**
 * Back on the board (no modal open — a `Modal` takes Back first through its
 * `onRequestClose`) must never end a game on one stray press (#315). Mid-game
 * it asks the same "Leave Game" question as the Leave button. Once there is a
 * winner nothing is left to lose, so it goes straight to the menu, like the
 * game-over card's "Back to Menu".
 */
export const getBoardBackAction = (isGameOver: boolean): BoardBackAction =>
  isGameOver ? 'back-to-menu' : 'confirm-leave';
