import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
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

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'new-game' && (
        <NewGameScreen
          onLocalMultiplayer={() => setCurrentScreen('local-game')}
          onOnlineMultiplayer={() => setCurrentScreen('multiplayer-menu')}
        />
      )}

      {currentScreen === 'local-game' && <LocalGame onBack={() => setCurrentScreen('new-game')} />}

      {currentScreen === 'multiplayer-menu' && (
        <MultiplayerMenuScreen
          onBack={() => setCurrentScreen('new-game')}
          onCreateRoom={() => setCurrentScreen('online-create')}
          onJoinRoom={() => setCurrentScreen('online-join')}
          onResumeGame={() => setCurrentScreen('online-resume')}
        />
      )}

      {(currentScreen === 'online-create' ||
        currentScreen === 'online-join' ||
        currentScreen === 'online-resume') && (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
});
