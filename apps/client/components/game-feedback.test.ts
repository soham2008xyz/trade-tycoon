import { describe, expect, it } from 'vitest';
import { getGameFeedback } from './game-feedback';

describe('getGameFeedback', () => {
  it('returns null when there is no reducer-driven feedback', () => {
    expect(getGameFeedback({ errorMessage: undefined, toastMessage: undefined })).toBeNull();
  });

  it('surfaces toast messages when no error is present', () => {
    expect(
      getGameFeedback({
        errorMessage: undefined,
        toastMessage: 'Auction started for Boardwalk!',
      })
    ).toEqual({
      message: 'Auction started for Boardwalk!',
      dismissAction: 'DISMISS_TOAST',
    });
  });

  it('prioritizes reducer errors over background toast messages', () => {
    expect(
      getGameFeedback({
        errorMessage: 'You must build evenly across the color group.',
        toastMessage: 'Trade completed!',
      })
    ).toEqual({
      message: 'You must build evenly across the color group.',
      dismissAction: 'DISMISS_ERROR',
    });
  });
});
