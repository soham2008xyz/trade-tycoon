import React from 'react';
import type { GameAction, GameState } from '@trade-tycoon/game-logic';
import { getGameFeedback } from '../components/game-feedback';

/**
 * The reducer's feedback toast, minus anything this client has dismissed.
 *
 * In multiplayer, dismissing reducer feedback is local-only: the server
 * rejects DISMISS_* actions online (any player could otherwise clear a
 * toast for the whole room), so we hide the toast on this client instead.
 */
export const useGameFeedback = (
  state: GameState,
  isMultiplayer: boolean,
  onDispatch: (action: GameAction) => void
) => {
  const gameFeedback = getGameFeedback(state, isMultiplayer);
  const [dismissedFeedback, setDismissedFeedback] = React.useState<string | null>(null);
  if (dismissedFeedback !== null && dismissedFeedback !== gameFeedback?.message) {
    // The feedback moved on from the dismissed message — drop the stale
    // dismissal during render so a later identical toast can reappear.
    setDismissedFeedback(null);
  }

  const feedback = gameFeedback && gameFeedback.message !== dismissedFeedback ? gameFeedback : null;
  const dismiss = () => {
    if (!feedback) return;
    if (isMultiplayer) setDismissedFeedback(feedback.message);
    else onDispatch({ type: feedback.dismissAction });
  };

  return { feedback, dismiss };
};
