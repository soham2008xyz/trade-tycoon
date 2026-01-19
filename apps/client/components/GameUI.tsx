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
}

export const GameUI: React.FC<GameUIProps> = ({
  state,
  currentPlayerId: myPlayerId,
  onDispatch,
  uiToastMessage,
  setUiToastMessage,
  onLeaveGame,
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
    if (state.currentPlayerId) {
      showAlert(
        'Declare Bankruptcy',
        'Are you sure you want to declare bankruptcy? You will be removed from the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () =>
              onDispatch({ type: 'DECLARE_BANKRUPTCY', playerId: state.currentPlayerId! }),
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
      playerId: state.currentPlayerId,
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
    onDispatch({ type: 'CANCEL_TRADE', playerId: state.currentPlayerId });
  };

  const handleRestart = () => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  };

  // Logic to determine availability
  // Note: For online multiplayer, we should only enable buttons if state.currentPlayerId === myPlayerId
  // BUT: "myPlayerId" passed here is purely "who am I".
  // The Board component doesn't know about "myPlayerId", it takes "currentPlayer" (the active player).
  // We need to disable controls if I am not the current player?
  // The Board component is designed for hotseat, so it enables controls for whoever is current.
  // For online, if I am NOT current player, I should simply not see controls or they should be disabled.
  // However, Board.tsx renders controls based on "currentPlayer".
  // If I pass "currentPlayer" as the active player, Board will render controls for them.
  // If I am NOT them, I shouldn't be able to click them.
  // We can wrap onDispatch to check? Or rely on server validation.
  // Ideally, Board would take "isMyTurn" prop.
  // For now, let's rely on server validation and UI state.
  // The Board component renders "Buy" / "Roll" etc.

  // Important: In Online mode, if it's not my turn, I shouldn't see "Roll Dice" button for the other player.
  // But Board.tsx likely renders it.
  // We might need to refactor Board to accept `isLocalTurn` or similar?
  // Or, we accept that for MVP everyone sees the buttons but they only work for the turn owner (and server enforces).
  // BETTER: We can conditionally pass callbacks as `undefined` if it's not my turn!

  // For hotseat (LocalGame), myPlayerId can be ignored or treated as "always me".
  // Actually, for LocalGame, we pass myPlayerId as the current player ID always?
  // Let's handle this logic in parent or here.

  // If `myPlayerId` is provided (Online), we check match.
  // If `myPlayerId` is null/undefined or special (Local), we allow all.

  // Actually, let's just use the callbacks. If I click "Roll" and it's not my turn,
  // the server rejects it (Online). In Local, it always works.

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
