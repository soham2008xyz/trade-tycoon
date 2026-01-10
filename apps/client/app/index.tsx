import React, { useReducer, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, Alert, Platform } from 'react-native';
import { Board } from '../components/Board';
import { Toast } from '../components/ui/toast';
import { GameSetup } from '../components/GameSetup';
import { LogModal } from '../components/LogModal';
import { createInitialState, gameReducer, BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [setupVisible, setSetupVisible] = useState(true);
  const [logVisible, setLogVisible] = useState(false);

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

  const handleRollAgain = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'CONTINUE_TURN', playerId: state.currentPlayerId });
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

  const handleBuild = (propertyId: string) => {
    if (state.currentPlayerId) {
      dispatch({
        type: 'BUILD_HOUSE',
        playerId: state.currentPlayerId,
        propertyId,
      });
    }
  };

  const handleSell = (propertyId: string) => {
    if (state.currentPlayerId) {
      dispatch({
        type: 'SELL_HOUSE',
        playerId: state.currentPlayerId,
        propertyId,
      });
    }
  };

  const handleMortgage = (propertyId: string) => {
    if (state.currentPlayerId) {
      dispatch({
        type: 'MORTGAGE_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId,
      });
    }
  };

  const handleUnmortgage = (propertyId: string) => {
    if (state.currentPlayerId) {
      dispatch({
        type: 'UNMORTGAGE_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId,
      });
    }
  };

  const handlePayFine = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'PAY_FINE', playerId: state.currentPlayerId });
    }
  };

  const handleUseGOOJCard = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'USE_GOOJ_CARD', playerId: state.currentPlayerId });
    }
  };

  const handleDismissError = () => {
    dispatch({ type: 'DISMISS_ERROR' });
  };

  const handleDismissToast = () => {
    dispatch({ type: 'DISMISS_TOAST' });
  };

  const handleRestart = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to restart the game?');
      if (confirmed) {
        setSetupVisible(true);
      }
    } else {
      Alert.alert('Restart Game', 'Are you sure you want to restart the game?', [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => setSetupVisible(true),
        },
      ]);
    }
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
      <LogModal visible={logVisible} logs={state.logs} onClose={() => setLogVisible(false)} />
      {state.errorMessage && <Toast message={state.errorMessage} onDismiss={handleDismissError} />}
      {state.toastMessage && <Toast message={state.toastMessage} onDismiss={handleDismissToast} />}
      <View style={styles.boardArea}>
        <Board
          players={state.players}
          currentPlayer={currentPlayer}
          currentTile={currentTile}
          dice={state.dice}
          doublesCount={state.doublesCount}
          phase={state.phase}
          canBuy={canBuy}
          onRoll={handleRoll}
          onBuy={handleBuy}
          onEndTurn={handleEndTurn}
          onRollAgain={handleRollAgain}
          onBuild={handleBuild}
          onSell={handleSell}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
          onPayFine={handlePayFine}
          onUseGOOJCard={handleUseGOOJCard}
          onRestart={handleRestart}
          onShowLog={() => setLogVisible(true)}
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
