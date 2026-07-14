import type { GameState } from '@trade-tycoon/game-logic';

type FeedbackState = Pick<GameState, 'errorMessage' | 'toastMessage'>;

export interface GameFeedback {
  message: string;
  dismissAction: 'DISMISS_ERROR' | 'DISMISS_TOAST';
}

/**
 * Collapse reducer-driven feedback into the single in-game toast surface.
 * Errors take priority so an invalid move is visible immediately, while any
 * success/info toast can surface after the error is dismissed.
 *
 * `errorMessage` is player-specific feedback (e.g. "insufficient funds") and
 * is ignored when `isMultiplayer` is true: the server never persists or
 * broadcasts a game state carrying it (a rejected/soft-rejected action aborts
 * the write and reports the message only to the acting player's HTTP
 * response instead — see RoomManager.handleGameAction), so honoring it here
 * would only ever show a stale value from before a state update. Rejections
 * in multiplayer surface via the network-layer `error` toast instead.
 * `toastMessage` (shared announcements like "X won the auction!") is
 * intentionally still shown to everyone.
 */
export const getGameFeedback = (
  state: FeedbackState,
  isMultiplayer = false
): GameFeedback | null => {
  if (state.errorMessage && !isMultiplayer) {
    return {
      message: state.errorMessage,
      dismissAction: 'DISMISS_ERROR',
    };
  }

  if (state.toastMessage) {
    return {
      message: state.toastMessage,
      dismissAction: 'DISMISS_TOAST',
    };
  }

  return null;
};
