import { useMemo } from 'react';
import type { GameState, Player, Tile } from '@trade-tycoon/game-logic';
import { BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export interface StatusPanelActions {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  currentTile: Tile | null;
  canBuy: boolean;
  canAuction: boolean;
}

/**
 * Pure derivation of which status-panel actions are enabled for the local
 * user. Extracted out of GameUI/Board so the three StatusPanel variants
 * (Peek, Expanded, TabletCenter) share one source of truth.
 */
export function getStatusPanelActions(
  state: GameState,
  myPlayerId: string
): StatusPanelActions {
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;
  const isMyTurn = state.currentPlayerId === myPlayerId;

  const isPropertyUnowned =
    state.phase === 'action' &&
    !!currentPlayer &&
    !!currentTile &&
    isTileBuyable(currentTile) &&
    !state.players.some((p) => p.properties.includes(currentTile.id));

  const canAfford =
    !!currentPlayer && !!currentTile ? currentPlayer.money >= (currentTile.price || 0) : false;

  return {
    isMyTurn,
    currentPlayer,
    currentTile,
    canBuy: isPropertyUnowned && canAfford,
    canAuction: isPropertyUnowned,
  };
}

export function useStatusPanelActions(state: GameState, myPlayerId: string): StatusPanelActions {
  return useMemo(() => getStatusPanelActions(state, myPlayerId), [state, myPlayerId]);
}
