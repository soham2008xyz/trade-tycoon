import React from 'react';
import { Toast } from './ui/Toast';
import type { GameFeedback } from './game-feedback';

interface GameToastsProps {
  feedback: GameFeedback | null;
  onDismissFeedback: () => void;
  uiToastMessage: string | null;
  onDismissUiToast: () => void;
}

/** The reducer feedback toast and the UI toast, drawn together in whichever place hosts them. */
export const GameToasts: React.FC<GameToastsProps> = ({
  feedback,
  onDismissFeedback,
  uiToastMessage,
  onDismissUiToast,
}) => (
  <>
    {feedback && <Toast message={feedback.message} onDismiss={onDismissFeedback} />}
    {uiToastMessage && <Toast message={uiToastMessage} onDismiss={onDismissUiToast} />}
  </>
);
