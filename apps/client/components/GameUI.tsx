import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GameState, GameAction, BOARD, TradeOffer } from '@trade-tycoon/game-logic';
import { Toast } from './ui/Toast';
import { CustomAlert, AlertOptions } from './ui/Alert';
import { LogModal } from './LogModal';
import { TradeModal } from './TradeModal';
import { PropertyManager } from './PropertyManager';
import { TileInfoModal } from './TileInfoModal';
import { AuctionModal } from './AuctionModal';
import { TabletGameLayout } from './layouts/TabletGameLayout';
import { PhoneGameLayout } from './layouts/PhoneGameLayout';
import { useGameLayout } from '../hooks/useGameLayout';
import { getGameFeedback } from './game-feedback';

interface GameUIProps {
  state: GameState;
  currentPlayerId: string;
  onDispatch: (action: GameAction) => void;
  uiToastMessage: string | null;
  setUiToastMessage: (msg: string | null) => void;
  onLeaveGame: () => void;
  isHost?: boolean;
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
  const layout = useGameLayout();

  const [logVisible, setLogVisible] = React.useState(false);
  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertOptions, setAlertOptions] = React.useState<AlertOptions | null>(null);
  const [tradeTargetId, setTradeTargetId] = React.useState<string | undefined>(undefined);
  const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);
  const [showPropertyManager, setShowPropertyManager] = React.useState(false);
  const [isTokenMoving, setIsTokenMoving] = React.useState(false);

  const showAlert = (title: string, message: string, buttons: AlertOptions['buttons']) => {
    setAlertOptions({ title, message, buttons });
    setAlertVisible(true);
  };

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const selfId = myPlayerId;
  const getOwner = (tileId: string) => state.players.find((p) => p.properties.includes(tileId));

  const handleRoll = () => onDispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
  const handleEndTurn = () => onDispatch({ type: 'END_TURN', playerId: state.currentPlayerId });
  const handleBuy = () => {
    const tile = currentPlayer ? BOARD[currentPlayer.position] : null;
    if (state.currentPlayerId && tile) {
      onDispatch({ type: 'BUY_PROPERTY', playerId: state.currentPlayerId, propertyId: tile.id });
    }
  };
  const handleDeclineBuy = () => onDispatch({ type: 'DECLINE_BUY', playerId: state.currentPlayerId });
  const handlePayFine = () => onDispatch({ type: 'PAY_FINE', playerId: state.currentPlayerId });
  const handleUseGOOJ = () => onDispatch({ type: 'USE_GOOJ_CARD', playerId: state.currentPlayerId });
  const handleRollAgain = () => handleRoll();
  const handleBuild = (id: string) => onDispatch({ type: 'BUILD_HOUSE', playerId: state.currentPlayerId, propertyId: id });
  const handleSell = (id: string) => onDispatch({ type: 'SELL_HOUSE', playerId: state.currentPlayerId, propertyId: id });
  const handleMortgage = (id: string) => onDispatch({ type: 'MORTGAGE_PROPERTY', playerId: state.currentPlayerId, propertyId: id });
  const handleUnmortgage = (id: string) => onDispatch({ type: 'UNMORTGAGE_PROPERTY', playerId: state.currentPlayerId, propertyId: id });
  const handleBid = (playerId: string, amount: number) => onDispatch({ type: 'PLACE_BID', playerId, amount });
  const handleConcedeAuction = (playerId: string) => onDispatch({ type: 'CONCEDE_AUCTION', playerId });
  const handleProposeTrade = (target: string, offer: TradeOffer, request: TradeOffer) =>
    onDispatch({ type: 'PROPOSE_TRADE', playerId: myPlayerId, targetPlayerId: target, offer, request });
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
  const handleCancelTrade = () => onDispatch({ type: 'CANCEL_TRADE', playerId: myPlayerId });
  const handleDeclareBankruptcy = () => {
    if (myPlayerId) {
      showAlert('Declare Bankruptcy', 'Are you sure you want to declare bankruptcy? You will be removed from the game.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: () => onDispatch({ type: 'DECLARE_BANKRUPTCY', playerId: myPlayerId }) },
      ]);
    }
  };
  const handleRestart = () => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  };

  const gameFeedback = getGameFeedback(state);

  const sharedProps = {
    state,
    myPlayerId,
    isMultiplayer,
    onRoll: handleRoll,
    onBuy: handleBuy,
    onDeclineBuy: handleDeclineBuy,
    onEndTurn: handleEndTurn,
    onRollAgain: handleRollAgain,
    onPayFine: handlePayFine,
    onUseGOOJCard: handleUseGOOJ,
    onDeclareBankruptcy: handleDeclareBankruptcy,
    onShowLog: () => setLogVisible(true),
    onRestart: handleRestart,
    onOpenPropertyManager: () => setShowPropertyManager(true),
    onOpenTrade: (target: string) => setTradeTargetId(target),
    isTokenMoving,
    onTilePress: setSelectedTileId,
    onTokenMovingChange: setIsTokenMoving,
  };

  return (
    <View style={styles.container}>
      <LogModal
        visible={logVisible}
        logs={state.logs}
        players={state.players}
        onClose={() => setLogVisible(false)}
      />
      {gameFeedback && (
        <Toast message={gameFeedback.message} onDismiss={() => onDispatch({ type: gameFeedback.dismissAction })} />
      )}
      {uiToastMessage && <Toast message={uiToastMessage} onDismiss={() => setUiToastMessage(null)} />}
      <CustomAlert visible={alertVisible} options={alertOptions} onClose={() => setAlertVisible(false)} />

      {layout === 'phone' ? <PhoneGameLayout {...sharedProps} /> : <TabletGameLayout {...sharedProps} />}

      <AuctionModal
        visible={state.phase === 'auction'}
        auction={state.auction || null}
        players={state.players}
        onBid={handleBid}
        onConcede={handleConcedeAuction}
        isMultiplayer={isMultiplayer}
        myPlayerId={myPlayerId}
      />

      {currentPlayer && selfId && (
        <TradeModal
          visible={!!tradeTargetId || (!!state.activeTrade && (state.activeTrade.initiatorId === selfId || state.activeTrade.targetPlayerId === selfId))}
          players={state.players}
          currentPlayerId={selfId}
          targetPlayerId={tradeTargetId || state.activeTrade?.targetPlayerId}
          activeTrade={state.activeTrade}
          isMultiplayer={isMultiplayer}
          onPropose={(t, o, r) => {
            handleProposeTrade(t, o, r);
            setTradeTargetId(undefined);
          }}
          onAccept={handleAcceptTrade}
          onReject={handleRejectTrade}
          onCancel={() => {
            handleCancelTrade();
            setTradeTargetId(undefined);
          }}
          onClose={() => setTradeTargetId(undefined)}
        />
      )}

      {currentPlayer && (
        <PropertyManager
          visible={showPropertyManager}
          player={currentPlayer}
          onClose={() => setShowPropertyManager(false)}
          onBuild={handleBuild}
          onSell={handleSell}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />
      )}

      <TileInfoModal
        visible={!!selectedTileId}
        tile={selectedTileId ? BOARD.find((t) => t.id === selectedTileId) || null : null}
        owner={selectedTileId ? getOwner(selectedTileId) : undefined}
        onClose={() => setSelectedTileId(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', height: '100%' },
});
