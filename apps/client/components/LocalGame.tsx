import React, { useCallback, useReducer, useState } from 'react';
import { GameUI } from './GameUI';
import { GameSetup } from './GameSetup';
import { analytics } from './analytics';
import { createInitialState, gameReducer, GameAction } from '@trade-tycoon/game-logic';

interface LocalGameProps {
  onBack: () => void;
}

export const LocalGame: React.FC<LocalGameProps> = ({ onBack }) => {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [isSetup, setIsSetup] = useState(true); // Start in setup mode
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);

  const handleStartGame = (players: { name: string; color: string }[]) => {
    const playersWithIds = players.map((p, index) => ({
      ...p,
      id: `p${index + 1}`,
    }));
    dispatch({ type: 'RESET_GAME', players: playersWithIds });
    setIsSetup(false);
    analytics.trackEvent('start_local_game', { player_count: players.length });
  };

  // Wrapper to log or handle specific local checks if needed
  const handleDispatch = (action: GameAction) => {
    dispatch(action);
  };

  // Back to player setup; GameUI unmounts, and the next start dispatches
  // RESET_GAME, which clears the winner. Stable so it doesn't churn GameUI's
  // memoized layout props.
  const handleNewGame = useCallback(() => {
    setIsSetup(true);
  }, []);

  if (isSetup) {
    return <GameSetup onStartGame={handleStartGame} onBack={onBack} />;
  }

  return (
    <GameUI
      state={state}
      currentPlayerId={state.currentPlayerId} // In local game, "I" am always the current player
      onDispatch={handleDispatch}
      uiToastMessage={uiToastMessage}
      setUiToastMessage={setUiToastMessage}
      onLeaveGame={onBack}
      onNewGame={handleNewGame}
    />
  );
};
