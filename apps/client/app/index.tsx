import React, { useReducer, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, Alert, Platform } from 'react-native';
import { Board } from '../components/Board';
import { Toast } from '../components/ui/Toast';
import { CustomAlert, AlertButton, AlertOptions } from '../components/ui/Alert';
import { GameSetup } from '../components/GameSetup';
import { NewGameScreen } from '../components/NewGameScreen';
import { MultiplayerMenuScreen } from '../components/MultiplayerMenuScreen';
import { LogModal } from '../components/LogModal';
import {
  createInitialState,
  gameReducer,
  BOARD,
  isTileBuyable,
  TradeOffer,
} from '@trade-tycoon/game-logic';

type Screen = 'new-game' | 'game-setup' | 'multiplayer-menu' | 'game';

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [currentScreen, setCurrentScreen] = useState<Screen>('new-game');
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  const [logVisible, setLogVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  const showAlert = (title: string, message: string, buttons: AlertButton[]) => {
    if (Platform.OS === 'web') {
      setAlertOptions({ title, message, buttons });
      setAlertVisible(true);
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleStartGame = (players: { name: string; color: string }[]) => {
    const playersWithIds = players.map((p, index) => ({
      ...p,
      id: `p${index + 1}`,
    }));
    dispatch({ type: 'RESET_GAME', players: playersWithIds });
    setCurrentScreen('game');
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

  const handleDismissToast = () => {
    dispatch({ type: 'DISMISS_TOAST' });
  };

  const handleDeclareBankruptcy = () => {
    if (state.currentPlayerId) {
      showAlert(
        'Declare Bankruptcy',

        'Are you sure you want to declare bankruptcy? You will be removed from the game.',

        [
          {
            text: 'Cancel',

            style: 'cancel',
          },

          {
            text: 'Yes',

            style: 'destructive',

            onPress: () =>
              dispatch({ type: 'DECLARE_BANKRUPTCY', playerId: state.currentPlayerId! }),
          },
        ]
      );
    }
  };

  const handleDeclineBuy = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'DECLINE_BUY', playerId: state.currentPlayerId });
    }
  };

  const handleBid = (playerId: string, amount: number) => {
    dispatch({ type: 'PLACE_BID', playerId, amount });
  };

  const handleConcedeAuction = (playerId: string) => {
    dispatch({ type: 'CONCEDE_AUCTION', playerId });
  };

  const handleProposeTrade = (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => {
    if (state.currentPlayerId) {
      dispatch({
        type: 'PROPOSE_TRADE',
        playerId: state.currentPlayerId,
        targetPlayerId,
        offer,
        request,
      });
    }
  };

  const handleAcceptTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      // In local multiplayer, we assume the target player is clicking Accept
      dispatch({ type: 'ACCEPT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };

  const handleRejectTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      // In local multiplayer, we assume the target player is clicking Reject
      dispatch({ type: 'REJECT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };

  const handleCancelTrade = (tradeId: string) => {
    if (state.currentPlayerId) {
      dispatch({ type: 'CANCEL_TRADE', playerId: state.currentPlayerId });
    }
  };

  const handleRestart = () => {
    showAlert('Restart Game', 'Are you sure you want to restart the game?', [
      {
        text: 'No',
        style: 'cancel',
      },
      {
        text: 'Yes',
        onPress: () => setCurrentScreen('new-game'),
      },
    ]);
  };

  if (currentScreen === 'game' && !currentPlayer && !state.winner) return <Text>Loading...</Text>;

  // Check buy availability
  const isPropertyUnowned =
    state.phase === 'action' &&
    !!currentPlayer &&
    !!currentTile &&
    isTileBuyable(currentTile) &&
    !state.players.some((p) => p.properties.includes(currentTile.id));

  const canAfford =
    currentPlayer && currentTile ? currentPlayer.money >= (currentTile.price || 0) : false;

  const canBuy = isPropertyUnowned && canAfford;
  const canAuction = isPropertyUnowned;

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'new-game' && (
        <NewGameScreen
          onLocalMultiplayer={() => setCurrentScreen('game-setup')}
          onOnlineMultiplayer={() => setCurrentScreen('multiplayer-menu')}
        />
      )}
      {currentScreen === 'multiplayer-menu' && (
        <MultiplayerMenuScreen
          onBack={() => setCurrentScreen('new-game')}
          onToast={setUiToastMessage}
        />
      )}
      <GameSetup
        visible={currentScreen === 'game-setup'}
        onStartGame={handleStartGame}
        onBack={() => setCurrentScreen('new-game')}
      />
      <LogModal
        visible={logVisible}
        logs={state.logs}
        players={state.players}
        onClose={() => setLogVisible(false)}
      />
      {state.toastMessage && <Toast message={state.toastMessage} onDismiss={handleDismissToast} />}
      {uiToastMessage && (
        <Toast message={uiToastMessage} onDismiss={() => setUiToastMessage(null)} />
      )}
      <CustomAlert
        visible={alertVisible}
        options={alertOptions}
        onClose={() => setAlertVisible(false)}
      />
      <View style={styles.boardArea}>
        <Board
          players={state.players}
          currentPlayer={currentPlayer}
          currentTile={currentTile}
          dice={state.dice}
          doublesCount={state.doublesCount}
          phase={state.phase}
          auction={state.auction}
          activeTrade={state.activeTrade}
          canBuy={canBuy}
          canAuction={canAuction}
          onRoll={handleRoll}
          onBuy={handleBuy}
          onDeclineBuy={handleDeclineBuy}
          onBid={handleBid}
          onConcedeAuction={handleConcedeAuction}
          onEndTurn={handleEndTurn}
          onProposeTrade={handleProposeTrade}
          onAcceptTrade={handleAcceptTrade}
          onRejectTrade={handleRejectTrade}
          onCancelTrade={handleCancelTrade}
          onRollAgain={handleRollAgain}
          onBuild={handleBuild}
          onSell={handleSell}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
          onPayFine={handlePayFine}
          onUseGOOJCard={handleUseGOOJCard}
          onRestart={handleRestart}
          onShowLog={() => setLogVisible(true)}
          onDeclareBankruptcy={handleDeclareBankruptcy}
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
