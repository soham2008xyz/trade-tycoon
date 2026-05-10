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
 */
export const getGameFeedback = (state: FeedbackState): GameFeedback | null => {
  if (state.errorMessage) {
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
