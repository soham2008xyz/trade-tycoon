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
const PAGE_VIEWS: Record<Screen, { path: string; title: string }> = {
  'new-game': { path: '/', title: 'Main menu' },
  'local-game': { path: '/local-game', title: 'Local game' },
  'multiplayer-menu': { path: '/multiplayer', title: 'Multiplayer menu' },
  'online-create': { path: '/online/create', title: 'Create room' },
  'online-join': { path: '/online/join', title: 'Join room' },
  'online-resume': { path: '/online/resume', title: 'Resume game' },
};

export default function GameScreen() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('new-game');

  useEffect(() => {
    const { path, title } = PAGE_VIEWS[currentScreen];
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
