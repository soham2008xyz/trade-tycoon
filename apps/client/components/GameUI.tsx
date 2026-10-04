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
import { canRemovePlayer } from './multiplayer-gating';

interface GameUIProps {
  state: GameState;
  currentPlayerId: string;
  onDispatch: (action: GameAction) => void;
  uiToastMessage: string | null;
  setUiToastMessage: (msg: string | null) => void;
  onLeaveGame: () => void;
  /** Hotseat only: return to player setup. Online has no equivalent. */
  onNewGame?: () => void;
  isHost?: boolean;
  isMultiplayer?: boolean;
  /** Online only: players the server hasn't heard from lately. */
  disconnectedPlayerIds?: readonly string[];
  /** Online only: the room host's player id (a host can also be a bankrupt non-player). */
  hostId?: string;
  /** Online only: remove a disconnected player from the room. */
  onRemovePlayer?: (targetPlayerId: string) => void;
}

// Stable identity: a fresh `[]` per render would defeat `sharedProps` memoization.
const NO_PLAYERS: readonly string[] = [];

export const GameUI: React.FC<GameUIProps> = ({
  state,
  currentPlayerId: myPlayerId,
  onDispatch,
  uiToastMessage,
  setUiToastMessage,
  onLeaveGame,
  onNewGame,
  isMultiplayer = false,
  disconnectedPlayerIds = NO_PLAYERS,
  hostId,
  onRemovePlayer,
}) => {
  const layout = useGameLayout();

  const [logVisible, setLogVisible] = React.useState(false);
  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertOptions, setAlertOptions] = React.useState<AlertOptions | null>(null);
  const [tradeTargetId, setTradeTargetId] = React.useState<string | undefined>(undefined);
  const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);
  const [showPropertyManager, setShowPropertyManager] = React.useState(false);
  const [isTokenMoving, setIsTokenMoving] = React.useState(false);

  const showAlert = React.useCallback(
    (title: string, message: string, buttons: AlertOptions['buttons']) => {
      setAlertOptions({ title, message, buttons });
      setAlertVisible(true);
    },
    []
  );

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const myPlayer = state.players.find((p) => p.id === myPlayerId);
  const selfId = myPlayerId;
  // The reducer ignores everything but RESET_GAME/DISMISS_* once a winner is
  // set, so manage/trade surfaces left open (or opened) would do nothing.
  const isGameOver = !!state.winner;
  const getOwner = (tileId: string) => state.players.find((p) => p.properties.includes(tileId));

  // Layout-facing handlers are memoized so `sharedProps` below keeps a stable
  // identity across re-renders that don't touch game state (toasts, modal
  // visibility) — that stability is what lets the memoized Board/Tile subtree
  // skip re-rendering all 40 tiles. Handlers consumed only by the
  // non-memoized modals stay plain per-render functions.
  const handleRoll = React.useCallback(
    () => onDispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId }),
    [onDispatch, state.currentPlayerId]
  );
  const handleEndTurn = React.useCallback(
    () => onDispatch({ type: 'END_TURN', playerId: state.currentPlayerId }),
    [onDispatch, state.currentPlayerId]
  );
  const handleBuy = React.useCallback(() => {
    const tile = currentPlayer ? BOARD[currentPlayer.position] : null;
    if (state.currentPlayerId && tile) {
      onDispatch({ type: 'BUY_PROPERTY', playerId: state.currentPlayerId, propertyId: tile.id });
    }
  }, [onDispatch, currentPlayer, state.currentPlayerId]);
  const handleDeclineBuy = React.useCallback(
    () => onDispatch({ type: 'DECLINE_BUY', playerId: state.currentPlayerId }),
    [onDispatch, state.currentPlayerId]
  );
  const handlePayFine = React.useCallback(
    () => onDispatch({ type: 'PAY_FINE', playerId: state.currentPlayerId }),
    [onDispatch, state.currentPlayerId]
  );
  const handleUseGOOJ = React.useCallback(
    () => onDispatch({ type: 'USE_GOOJ_CARD', playerId: state.currentPlayerId }),
    [onDispatch, state.currentPlayerId]
  );
  // Property management is always attributed to the local player, not
  // whoever's turn it currently is — the reducer already rejects these
  // outside the actor's own turn (BUILD_HOUSE/SELL_HOUSE/MORTGAGE_PROPERTY/
  // UNMORTGAGE_PROPERTY all guard on `state.currentPlayerId === action.playerId`),
  // so sending the true actor's id lets that turn check do its job instead of
  // silently attributing the action to whoever `state.currentPlayerId` happens
  // to be if the manage panel is still open when the turn changes underneath it.
  const handleBuild = (id: string) =>
    onDispatch({ type: 'BUILD_HOUSE', playerId: myPlayerId, propertyId: id });
  const handleSell = (id: string) =>
    onDispatch({ type: 'SELL_HOUSE', playerId: myPlayerId, propertyId: id });
  const handleMortgage = (id: string) =>
    onDispatch({ type: 'MORTGAGE_PROPERTY', playerId: myPlayerId, propertyId: id });
  const handleUnmortgage = (id: string) =>
    onDispatch({ type: 'UNMORTGAGE_PROPERTY', playerId: myPlayerId, propertyId: id });
  const handleBid = (playerId: string, amount: number) =>
    onDispatch({ type: 'PLACE_BID', playerId, amount });
  const handleConcedeAuction = (playerId: string) =>
    onDispatch({ type: 'CONCEDE_AUCTION', playerId });
  const handleProposeTrade = (target: string, offer: TradeOffer, request: TradeOffer) =>
    onDispatch({
      type: 'PROPOSE_TRADE',
      playerId: myPlayerId,
      targetPlayerId: target,
      offer,
      request,
    });
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
  const handleDeclareBankruptcy = React.useCallback(() => {
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
  }, [myPlayerId, onDispatch, showAlert]);
  const handleRestart = React.useCallback(() => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  }, [onLeaveGame, showAlert]);

  // Which disconnected players the local user may remove, resolved once here so
  // the panels just render buttons for these ids (the rule lives in
  // `canRemovePlayer`). Nothing is removable once the game is over: the server
  // rejects it and the panels show the game-over card instead.
  const removablePlayerIds = React.useMemo(
    () =>
      isGameOver || !onRemovePlayer
        ? NO_PLAYERS
        : state.players
            .filter((p) =>
              canRemovePlayer({
                selfId: myPlayerId,
                hostId,
                targetId: p.id,
                disconnectedPlayerIds,
                isMultiplayer,
              })
            )
            .map((p) => p.id),
    [
      isGameOver,
      onRemovePlayer,
      state.players,
      myPlayerId,
      hostId,
      disconnectedPlayerIds,
      isMultiplayer,
    ]
  );
  const handleRemovePlayer = React.useCallback(
    (targetId: string) => {
      const name = state.players.find((p) => p.id === targetId)?.name ?? 'this player';
      showAlert(
        'Remove Player',
        `Remove ${name} from the game? They've lost connection. Their turn will pass to the next player and they won't be able to rejoin.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onRemovePlayer?.(targetId) },
        ]
      );
    },
    [state.players, onRemovePlayer, showAlert]
  );

  const gameFeedback = getGameFeedback(state, isMultiplayer);

  // In multiplayer, dismissing reducer feedback is local-only: the server
  // rejects DISMISS_* actions online (any player could otherwise clear a
  // toast for the whole room), so we hide the toast on this client instead.
  const [dismissedFeedback, setDismissedFeedback] = React.useState<string | null>(null);
  if (dismissedFeedback !== null && dismissedFeedback !== gameFeedback?.message) {
    // The feedback moved on from the dismissed message — drop the stale
    // dismissal during render so a later identical toast can reappear.
    setDismissedFeedback(null);
  }

  const openLog = React.useCallback(() => setLogVisible(true), []);
  const openPropertyManager = React.useCallback(() => setShowPropertyManager(true), []);
  const openTrade = React.useCallback((target: string) => setTradeTargetId(target), []);

  const sharedProps = React.useMemo(
    () => ({
      state,
      myPlayerId,
      isMultiplayer,
      disconnectedPlayerIds,
      removablePlayerIds,
      onRemovePlayer: handleRemovePlayer,
      onRoll: handleRoll,
      onBuy: handleBuy,
      onDeclineBuy: handleDeclineBuy,
      onEndTurn: handleEndTurn,
      onRollAgain: handleRoll,
      onPayFine: handlePayFine,
      onUseGOOJCard: handleUseGOOJ,
      onDeclareBankruptcy: handleDeclareBankruptcy,
      onShowLog: openLog,
      onRestart: handleRestart,
      onBackToMenu: onLeaveGame,
      onNewGame,
      onOpenPropertyManager: openPropertyManager,
      onOpenTrade: openTrade,
      isTokenMoving,
      onTilePress: setSelectedTileId,
      onTokenMovingChange: setIsTokenMoving,
    }),
    [
      state,
      myPlayerId,
      isMultiplayer,
      disconnectedPlayerIds,
      removablePlayerIds,
      handleRemovePlayer,
      isTokenMoving,
      handleRoll,
      handleBuy,
      handleDeclineBuy,
      handleEndTurn,
      handlePayFine,
      handleUseGOOJ,
      handleDeclareBankruptcy,
      openLog,
      handleRestart,
      onLeaveGame,
      onNewGame,
      openPropertyManager,
      openTrade,
    ]
  );

  return (
    <View style={styles.container}>
      <LogModal
        visible={logVisible}
        logs={state.logs}
        players={state.players}
        onClose={() => setLogVisible(false)}
      />
      {gameFeedback && gameFeedback.message !== dismissedFeedback && (
        <Toast
          message={gameFeedback.message}
          onDismiss={
            isMultiplayer
              ? () => setDismissedFeedback(gameFeedback.message)
              : () => onDispatch({ type: gameFeedback.dismissAction })
          }
        />
      )}
      {uiToastMessage && (
        <Toast message={uiToastMessage} onDismiss={() => setUiToastMessage(null)} />
      )}
      <CustomAlert
        visible={alertVisible}
        options={alertOptions}
        onClose={() => setAlertVisible(false)}
      />

      {layout === 'phone' ? (
        <PhoneGameLayout {...sharedProps} />
      ) : (
        <TabletGameLayout {...sharedProps} />
      )}

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
          visible={
            !isGameOver &&
            (!!tradeTargetId ||
              (!!state.activeTrade &&
                (state.activeTrade.initiatorId === selfId ||
                  state.activeTrade.targetPlayerId === selfId)))
          }
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

      {/* Bound to the local player, not `currentPlayer` (whoever's turn it
          is) — otherwise the panel can end up showing and acting on a
          different player's assets if the turn changes while it's open. */}
      {myPlayer && (
        <PropertyManager
          visible={showPropertyManager && !isGameOver}
          player={myPlayer}
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
