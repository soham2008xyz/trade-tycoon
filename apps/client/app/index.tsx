import React, { useEffect, useState } from 'react';
import { NewGameScreen } from '../components/NewGameScreen';
import { MultiplayerMenuScreen } from '../components/MultiplayerMenuScreen';
import { LocalGame } from '../components/LocalGame';
import { OnlineGame } from '../components/OnlineGame';
import { analytics } from '../components/analytics';

type Screen =
  | 'new-game'
  | 'local-game'
  | 'multiplayer-menu'
  | 'online-create'
  | 'online-join'
  | 'online-resume';

// Screens are a state machine, not routes, so the URL never changes; each one
// is reported to analytics as a virtual page (#334).
function pageViewFor(screen: Screen): { path: string; title: string } {
  switch (screen) {
    case 'new-game':
      return { path: '/', title: 'Main menu' };
    case 'local-game':
      return { path: '/local-game', title: 'Local game' };
    case 'multiplayer-menu':
      return { path: '/multiplayer', title: 'Multiplayer menu' };
    case 'online-create':
      return { path: '/online/create', title: 'Create room' };
    case 'online-join':
      return { path: '/online/join', title: 'Join room' };
    case 'online-resume':
      return { path: '/online/resume', title: 'Resume game' };
  }
}

export default function GameScreen() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('new-game');

  useEffect(() => {
    const { path, title } = pageViewFor(currentScreen);
    analytics.trackPageView(path, title);
  }, [currentScreen]);

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
      onMainMenu={() => setCurrentScreen('new-game')}
    />
  );
}
