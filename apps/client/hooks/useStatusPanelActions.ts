import { useMemo } from 'react';
import type { GameState, Player, Tile } from '@trade-tycoon/game-logic';
import { BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export interface VisibleButton {
  visible: boolean;
}
export interface PayFineButton extends VisibleButton {
  enabled: boolean;
}
export interface UseGOOJButton extends VisibleButton {
  count: number;
}
export interface BuyButton extends VisibleButton {
  price: number;
}

/**
 * One source of truth for which phase-action buttons render in the status
 * panel, regardless of which variant (Peek / Expanded / TabletCenter) is
 * doing the rendering. Each entry is a self-describing record: `visible`
 * for the gate, plus any extras the label needs (price, GOOJ count, etc).
 *
 * Adding a new button means adding a key here and reading it from each
 * variant — the rule lives in one tested place.
 */
export interface StatusPanelButtons {
  roll: VisibleButton;
  payFine: PayFineButton;
  useGOOJCard: UseGOOJButton;
  declareBankruptcy: VisibleButton;
  buy: BuyButton;
  auction: VisibleButton;
  manage: VisibleButton;
  rollAgain: VisibleButton;
  endTurn: VisibleButton;
  /**
   * When true, the panel renders "Waiting for X to play…" instead of the
   * action buttons. Mutually exclusive with every other visible button.
   */
  waiting: VisibleButton;
}

export interface StatusPanelActions {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  currentTile: Tile | null;
  canBuy: boolean;
  canAuction: boolean;
  buttons: StatusPanelButtons;
}

/**
 * Pure derivation of which status-panel actions are enabled for the local
 * user. Extracted out of GameUI/Board so the three StatusPanel variants
 * (Peek, Expanded, TabletCenter) share one source of truth.
 *
 * @param isTokenMoving — whether a player token is currently animating.
 *   While true, action-phase buttons are hidden so the user can't dispatch
 *   a follow-up action before the previous one has visually settled. Roll-
 *   phase buttons (Roll Dice, Pay Fine, GOOJ) are unaffected because the
 *   roll precedes any animation.
 */
export function getStatusPanelActions(
  state: GameState,
  myPlayerId: string,
  isTokenMoving: boolean = false
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

  const canBuy = isPropertyUnowned && canAfford;
  const canAuction = isPropertyUnowned;

  const inRoll = isMyTurn && state.phase === 'roll' && !!currentPlayer;
  const inAction = isMyTurn && state.phase === 'action' && !!currentPlayer && !isTokenMoving;
  const isJailed = !!currentPlayer?.isInJail;
  const goojCount = currentPlayer?.getOutOfJailCards ?? 0;
  const inDoubles = state.doublesCount > 0;
  const playerMoney = currentPlayer?.money ?? 0;

  const buttons: StatusPanelButtons = {
    roll: { visible: inRoll },
    payFine: { visible: inRoll && isJailed, enabled: playerMoney >= 50 },
    useGOOJCard: { visible: inRoll && isJailed && goojCount > 0, count: goojCount },
    declareBankruptcy: { visible: isMyTurn && !!currentPlayer && playerMoney < 0 },
    buy: { visible: inAction && canBuy, price: currentTile?.price ?? 0 },
    auction: { visible: inAction && canAuction },
    manage: { visible: inAction && !inDoubles },
    rollAgain: { visible: inAction && inDoubles },
    endTurn: { visible: inAction && !inDoubles },
    waiting: { visible: !isMyTurn && !!currentPlayer },
  };

  return {
    isMyTurn,
    currentPlayer,
    currentTile,
    canBuy,
    canAuction,
    buttons,
  };
}

export function useStatusPanelActions(
  state: GameState,
  myPlayerId: string,
  isTokenMoving: boolean = false
): StatusPanelActions {
  return useMemo(
    () => getStatusPanelActions(state, myPlayerId, isTokenMoving),
    [state, myPlayerId, isTokenMoving]
  );
}
