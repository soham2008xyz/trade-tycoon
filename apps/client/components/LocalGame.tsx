import React, { useReducer, useState } from 'react';
import { GameUI } from './GameUI';
import { GameSetup } from './GameSetup';
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
  };

  // Wrapper to log or handle specific local checks if needed
  const handleDispatch = (action: GameAction) => {
    dispatch(action);
  };

  if (isSetup) {
    return <GameSetup visible={true} onStartGame={handleStartGame} onBack={onBack} />;
  }

  return (
    <GameUI
      state={state}
      currentPlayerId={state.currentPlayerId} // In local game, "I" am always the current player
      onDispatch={handleDispatch}
      uiToastMessage={uiToastMessage}
      setUiToastMessage={setUiToastMessage}
      onLeaveGame={onBack}
    />
  );
};
