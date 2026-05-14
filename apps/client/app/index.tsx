import React, { useState } from 'react';
import { NewGameScreen } from '../components/NewGameScreen';
import { MultiplayerMenuScreen } from '../components/MultiplayerMenuScreen';
import { LocalGame } from '../components/LocalGame';
import { OnlineGame } from '../components/OnlineGame';

type Screen =
  | 'new-game'
  | 'local-game'
  | 'multiplayer-menu'
  | 'online-create'
  | 'online-join'
  | 'online-resume';

export default function GameScreen() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('new-game');

  return renderCurrentScreen(currentScreen, setCurrentScreen);
}

function renderCurrentScreen(
  currentScreen: Screen,
  setCurrentScreen: React.Dispatch<React.SetStateAction<Screen>>
) {
  if (currentScreen === 'new-game') {
    return (
      <NewGameScreen
        onLocalMultiplayer={() => setCurrentScreen('local-game')}
        onOnlineMultiplayer={() => setCurrentScreen('multiplayer-menu')}
      />
    );
  }

  if (currentScreen === 'local-game') {
    return <LocalGame onBack={() => setCurrentScreen('new-game')} />;
  }

  if (currentScreen === 'multiplayer-menu') {
    return (
      <MultiplayerMenuScreen
        onBack={() => setCurrentScreen('new-game')}
        onCreateRoom={() => setCurrentScreen('online-create')}
        onJoinRoom={() => setCurrentScreen('online-join')}
        onResumeGame={() => setCurrentScreen('online-resume')}
      />
    );
  }

  return (
    <OnlineGame
      initialMode={
        currentScreen === 'online-create'
          ? 'create'
          : currentScreen === 'online-join'
            ? 'join'
            : 'resume'
      }
      onBack={() => setCurrentScreen('multiplayer-menu')}
    />
  );
}
