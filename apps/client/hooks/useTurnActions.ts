import React from 'react';
import { BOARD, type GameAction, type GameState } from '@trade-tycoon/game-logic';

interface TurnActionsParams {
  state: GameState;
  onDispatch: (action: GameAction) => void;
}

/**
 * The status panel's turn buttons, each dispatching for whoever holds the turn.
 * Memoized as one object so the layout props that spread it keep a stable
 * identity across re-renders that don't touch game state (toasts, modal
 * visibility) — that stability is what lets the memoized Board/Tile subtree
 * skip re-rendering all 40 tiles.
 */
export const useTurnActions = (params: TurnActionsParams) => {
  const { state, onDispatch } = params;
  const turnPlayerId = state.currentPlayerId;
  const currentPlayer = state.players.find((p) => p.id === turnPlayerId);

  const onRoll = React.useCallback(() => {
    onDispatch({ type: 'ROLL_DICE', playerId: turnPlayerId });
  }, [onDispatch, turnPlayerId]);
  const onEndTurn = React.useCallback(() => {
    onDispatch({ type: 'END_TURN', playerId: turnPlayerId });
  }, [onDispatch, turnPlayerId]);
  const onBuy = React.useCallback(() => {
    const tile = currentPlayer ? BOARD[currentPlayer.position] : null;
    if (turnPlayerId && tile) {
      onDispatch({ type: 'BUY_PROPERTY', playerId: turnPlayerId, propertyId: tile.id });
    }
  }, [onDispatch, currentPlayer, turnPlayerId]);
  const onDeclineBuy = React.useCallback(() => {
    onDispatch({ type: 'DECLINE_BUY', playerId: turnPlayerId });
  }, [onDispatch, turnPlayerId]);
  const onPayFine = React.useCallback(() => {
    onDispatch({ type: 'PAY_FINE', playerId: turnPlayerId });
  }, [onDispatch, turnPlayerId]);
  const onUseGOOJCard = React.useCallback(() => {
    onDispatch({ type: 'USE_GOOJ_CARD', playerId: turnPlayerId });
  }, [onDispatch, turnPlayerId]);

  return React.useMemo(
    () => ({
      onRoll,
      onBuy,
      onDeclineBuy,
      onEndTurn,
      onRollAgain: onRoll,
      onPayFine,
      onUseGOOJCard,
    }),
    [onRoll, onBuy, onDeclineBuy, onEndTurn, onPayFine, onUseGOOJCard]
  );
};
