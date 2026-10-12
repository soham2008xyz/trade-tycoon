import React from 'react';
import type { GameAction, GameState, TradeOffer } from '@trade-tycoon/game-logic';

interface TradeFlowParams {
  state: GameState;
  selfId: string;
  isGameOver: boolean;
  onDispatch: (action: GameAction) => void;
}

/**
 * Everything the trade modal needs: which opponent is being traded with (before a
 * proposal exists), whether the modal is open, and the handlers behind its buttons.
 * Trades are attributed to the local player, not whoever's turn it is.
 */
export const useTradeFlow = (params: TradeFlowParams) => {
  const { state, selfId, isGameOver, onDispatch } = params;
  const [tradeTargetId, setTradeTargetId] = React.useState<string | undefined>(undefined);
  const activeTrade = state.activeTrade;

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  // The modal mounts only for a resolvable local player, and shows while they
  // are drafting a proposal or are a party to the open trade.
  const mounted = !!currentPlayer && !!selfId;
  const involvesSelf =
    !!activeTrade && (activeTrade.initiatorId === selfId || activeTrade.targetPlayerId === selfId);
  const visible = mounted && !isGameOver && (!!tradeTargetId || involvesSelf);

  const openTrade = React.useCallback((target: string) => {
    setTradeTargetId(target);
  }, []);
  const onClose = () => {
    setTradeTargetId(undefined);
  };
  const onPropose = (target: string, offer: TradeOffer, request: TradeOffer) => {
    onDispatch({
      type: 'PROPOSE_TRADE',
      playerId: selfId,
      targetPlayerId: target,
      offer,
      request,
    });
    setTradeTargetId(undefined);
  };
  const onAccept = (tradeId: string) => {
    if (activeTrade && activeTrade.id === tradeId) {
      onDispatch({ type: 'ACCEPT_TRADE', playerId: activeTrade.targetPlayerId });
    }
  };
  const onReject = (tradeId: string) => {
    if (activeTrade && activeTrade.id === tradeId) {
      onDispatch({ type: 'REJECT_TRADE', playerId: activeTrade.targetPlayerId });
    }
  };
  const onCancel = () => {
    onDispatch({ type: 'CANCEL_TRADE', playerId: selfId });
    setTradeTargetId(undefined);
  };

  return {
    mounted,
    visible,
    targetPlayerId: tradeTargetId || activeTrade?.targetPlayerId,
    openTrade,
    onClose,
    onPropose,
    onAccept,
    onReject,
    onCancel,
  };
};
