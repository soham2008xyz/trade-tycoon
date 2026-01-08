import React, { useReducer, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Text, useWindowDimensions } from 'react-native';
import { Board } from '../components/Board';
import { Toast } from '../components/ui/toast';
import { createInitialState, gameReducer, BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;

  // Add 2 local players on mount
  useEffect(() => {
    dispatch({ type: 'JOIN_GAME', playerId: 'p1', name: 'Player 1' });
    dispatch({ type: 'JOIN_GAME', playerId: 'p2', name: 'Player 2' });
  }, []);

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

  if (!currentPlayer) return <Text>Loading...</Text>;

  // Check buy availability
  const canBuy =
    state.phase === 'action' &&
    !!currentTile &&
    isTileBuyable(currentTile) &&
    !state.players.some((p) => p.properties.includes(currentTile.id)) &&
    currentPlayer.money >= (currentTile.price || 0);

  return (
    <SafeAreaView style={styles.container}>
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
