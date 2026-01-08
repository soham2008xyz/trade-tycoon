import React, { useReducer, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, useWindowDimensions } from 'react-native';
import { Board } from '../components/Board';
import { Toast } from '../components/ui/toast';
import { GameSetup } from '../components/GameSetup';
import { createInitialState, gameReducer, BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [setupVisible, setSetupVisible] = useState(true);
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;

  const handleStartGame = (players: { name: string; color: string }[]) => {
    const playersWithIds = players.map((p, index) => ({
      ...p,
      id: `p${index + 1}`,
    }));
    dispatch({ type: 'RESET_GAME', players: playersWithIds });
    setSetupVisible(false);
  };

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;

  const handleRoll = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
    }
  };

  const handleEndTurn = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'END_TURN', playerId: state.currentPlayerId });
    }
  };

  const handleBuy = () => {
    if (state.currentPlayerId && currentTile) {
      dispatch({
        type: 'BUY_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId: currentTile.id,
      });
    }
  };

  const handleDismissError = () => {
    dispatch({ type: 'DISMISS_ERROR' });
  };

  const handleDismissToast = () => {
    dispatch({ type: 'DISMISS_TOAST' });
  };

  if (!setupVisible && !currentPlayer) return <Text>Loading...</Text>;

  // Check buy availability
  const canBuy =
    state.phase === 'action' &&
    !!currentPlayer &&
    !!currentTile &&
    isTileBuyable(currentTile) &&
    !state.players.some((p) => p.properties.includes(currentTile.id)) &&
    currentPlayer.money >= (currentTile.price || 0);

  return (
    <SafeAreaView style={styles.container}>
      <GameSetup visible={setupVisible} onStartGame={handleStartGame} />
      {state.errorMessage && <Toast message={state.errorMessage} onDismiss={handleDismissError} />}
      {state.toastMessage && <Toast message={state.toastMessage} onDismiss={handleDismissToast} />}
      <View style={styles.boardArea}>
        <Board
          players={state.players}
          currentPlayer={currentPlayer}
          currentTile={currentTile}
          dice={state.dice}
          phase={state.phase}
          canBuy={canBuy}
          onRoll={handleRoll}
          onBuy={handleBuy}
          onEndTurn={handleEndTurn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  boardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
});
