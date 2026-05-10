import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Board } from './Board';
import { Toast } from './ui/Toast';
import { CustomAlert, AlertOptions } from './ui/Alert';

import { LogModal } from './LogModal';
import { GameState, GameAction, BOARD, isTileBuyable, TradeOffer } from '@trade-tycoon/game-logic';

interface GameUIProps {
  state: GameState;
  currentPlayerId: string; // The ID of the "local" player (me)
  onDispatch: (action: GameAction) => void;
  uiToastMessage: string | null;
  setUiToastMessage: (msg: string | null) => void;
  onLeaveGame: () => void;
  isHost?: boolean; // If needed for host-specific controls
  /**
   * True when this UI is rendered inside an online multiplayer game.
   * Forwarded to `Board` and `AuctionModal` so per-client UIs (like the
   * auction window) only render controls for the local user, not for every
   * participant. Defaults to false (local hotseat play).
   */
  isMultiplayer?: boolean;
}

export const GameUI: React.FC<GameUIProps> = ({
  state,
  currentPlayerId: myPlayerId,
  onDispatch,
  uiToastMessage,
  setUiToastMessage,
  onLeaveGame,
  isMultiplayer = false,
}) => {
  const [logVisible, setLogVisible] = React.useState(false);
  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertOptions, setAlertOptions] = React.useState<AlertOptions | null>(null);

  const showAlert = (title: string, message: string, buttons: any[]) => {
    if (Platform.OS === 'web') {
      setAlertOptions({ title, message, buttons });
      setAlertVisible(true);
    } else {
      // Native alert handling would go here, but for now using web custom alert logic mostly
      // Or use React Native Alert
      // Alert.alert(title, message, buttons);
      // For consistency in this component, let's use CustomAlert for web and native Alert for native
      // But CustomAlert is rendered below.
      setAlertOptions({ title, message, buttons });
      setAlertVisible(true);
    }
  };

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;

  // Actions
  const handleRoll = () => {
    onDispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
  };

  const handleRollAgain = () => {
    onDispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
  };

  const handleEndTurn = () => {
    onDispatch({ type: 'END_TURN', playerId: state.currentPlayerId });
  };

  const handleBuy = () => {
    if (state.currentPlayerId && currentTile) {
      onDispatch({
        type: 'BUY_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId: currentTile.id,
      });
    }
  };

  const handleBuild = (propertyId: string) => {
    onDispatch({
      type: 'BUILD_HOUSE',
      playerId: state.currentPlayerId,
      propertyId,
    });
  };

  const handleSell = (propertyId: string) => {
    onDispatch({
      type: 'SELL_HOUSE',
      playerId: state.currentPlayerId,
      propertyId,
    });
  };

  const handleMortgage = (propertyId: string) => {
    onDispatch({
      type: 'MORTGAGE_PROPERTY',
      playerId: state.currentPlayerId,
      propertyId,
    });
  };

  const handleUnmortgage = (propertyId: string) => {
    onDispatch({
      type: 'UNMORTGAGE_PROPERTY',
      playerId: state.currentPlayerId,
      propertyId,
    });
  };

  const handlePayFine = () => {
    onDispatch({ type: 'PAY_FINE', playerId: state.currentPlayerId });
  };

  const handleUseGOOJCard = () => {
    onDispatch({ type: 'USE_GOOJ_CARD', playerId: state.currentPlayerId });
  };

  const handleDismissToast = () => {
    onDispatch({ type: 'DISMISS_TOAST' });
  };

  const handleDeclareBankruptcy = () => {
    if (myPlayerId) {
      showAlert(
        'Declare Bankruptcy',
        'Are you sure you want to declare bankruptcy? You will be removed from the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => onDispatch({ type: 'DECLARE_BANKRUPTCY', playerId: myPlayerId }),
          },
        ]
      );
    }
  };

  const handleDeclineBuy = () => {
    onDispatch({ type: 'DECLINE_BUY', playerId: state.currentPlayerId });
  };

  const handleBid = (playerId: string, amount: number) => {
    onDispatch({ type: 'PLACE_BID', playerId, amount });
  };

  const handleConcedeAuction = (playerId: string) => {
    onDispatch({ type: 'CONCEDE_AUCTION', playerId });
  };

  const handleProposeTrade = (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => {
    onDispatch({
      type: 'PROPOSE_TRADE',
      playerId: myPlayerId,
      targetPlayerId,
      offer,
      request,
    });
  };

  const handleAcceptTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      onDispatch({ type: 'ACCEPT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };

  const handleRejectTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      onDispatch({ type: 'REJECT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };

  const handleCancelTrade = (tradeId: string) => {
    onDispatch({ type: 'CANCEL_TRADE', playerId: myPlayerId });
  };

  const handleRestart = () => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  };

  // For online multiplayer the action buttons (Roll, Buy, End Turn, etc.)
  // must only render for the player whose turn it is — otherwise idle
  // viewers see buttons that the server's `playerId === userId` check
  // rejects on click. In local hotseat play `myPlayerId` is set to the
  // active player by the parent, so this stays true and the UI is
  // unchanged. The Board component receives this and gates its `<actions>`
  // block accordingly.
  const isMyTurn = state.currentPlayerId === myPlayerId;

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
    <View style={styles.container}>
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
          isMyTurn={isMyTurn}
          isMultiplayer={isMultiplayer}
          myPlayerId={myPlayerId}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
    width: '100%',
    height: '100%',
  },
  boardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
});
