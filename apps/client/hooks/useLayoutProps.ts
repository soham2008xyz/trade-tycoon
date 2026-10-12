import React from 'react';
import type { GameUIProps } from '../components/game-ui-props';
import type { GameFlows } from './useGameFlows';

/**
 * The props shared by the phone and tablet layouts. Memoized so they keep a
 * stable identity across re-renders that don't touch game state (toasts, modal
 * visibility) — that stability is what lets the memoized Board/Tile subtree
 * skip re-rendering all 40 tiles.
 */
export const useLayoutProps = (props: GameUIProps, flows: GameFlows) => {
  const { state, currentPlayerId: myPlayerId, onLeaveGame, onBackToMenu, onNewGame } = props;
  const { isMultiplayer, disconnectedPlayerIds, turn, exit, removal, isTokenMoving } = flows;
  const { openLog, selectTile, setIsTokenMoving } = flows;
  const openPropertyManager = flows.manager.open;
  const openTrade = flows.trade.openTrade;

  return React.useMemo(
    () => ({
      state,
      myPlayerId,
      isMultiplayer,
      disconnectedPlayerIds,
      removablePlayerIds: removal.removablePlayerIds,
      onRemovePlayer: removal.confirmRemove,
      ...turn,
      onDeclareBankruptcy: exit.onDeclareBankruptcy,
      onShowLog: openLog,
      onRestart: exit.onRestart,
      onBackToMenu: onBackToMenu ?? onLeaveGame,
      onNewGame,
      onOpenPropertyManager: openPropertyManager,
      onOpenTrade: openTrade,
      isTokenMoving,
      onTilePress: selectTile,
      onTokenMovingChange: setIsTokenMoving,
    }),
    [
      state,
      myPlayerId,
      isMultiplayer,
      disconnectedPlayerIds,
      removal.removablePlayerIds,
      removal.confirmRemove,
      turn,
      exit.onDeclareBankruptcy,
      exit.onRestart,
      openLog,
      onBackToMenu,
      onLeaveGame,
      onNewGame,
      openPropertyManager,
      openTrade,
      isTokenMoving,
      selectTile,
      setIsTokenMoving,
    ]
  );
};
