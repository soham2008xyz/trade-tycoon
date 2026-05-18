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
 * Intermediate boolean gates that the button-visibility rules consume.
 * Extracted from `getStatusPanelActions` so the buttons-map computation
 * stays a flat record of single-comparison rules and each function has a
 * narrow cyclomatic complexity instead of one big branch chain.
 */
interface ActionGates {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  currentTile: Tile | null;
  inRoll: boolean;
  inAction: boolean;
  isJailed: boolean;
  inDoubles: boolean;
  goojCount: number;
  playerMoney: number;
  canBuy: boolean;
  canAuction: boolean;
}

function computeGates(state: GameState, myPlayerId: string, isTokenMoving: boolean): ActionGates {
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;
  const isMyTurn = state.currentPlayerId === myPlayerId;
  const playerMoney = currentPlayer?.money ?? 0;

  const propertyUnowned = isPropertyUnowned(state, currentPlayer, currentTile);
  const canAfford = canAffordCurrentTile(currentPlayer, currentTile);

  return {
    isMyTurn,
    currentPlayer,
    currentTile,
    inRoll: isMyTurn && state.phase === 'roll' && !!currentPlayer,
    inAction: isMyTurn && state.phase === 'action' && !!currentPlayer && !isTokenMoving,
    isJailed: !!currentPlayer?.isInJail,
    inDoubles: state.doublesCount > 0,
    goojCount: currentPlayer?.getOutOfJailCards ?? 0,
    playerMoney,
    canBuy: propertyUnowned && canAfford,
    canAuction: propertyUnowned,
  };
}

function isPropertyUnowned(
  state: GameState,
  currentPlayer: Player | undefined,
  currentTile: Tile | null
): boolean {
  if (state.phase !== 'action' || !currentPlayer || !currentTile) return false;
  if (!isTileBuyable(currentTile)) return false;
  return !state.players.some((p) => p.properties.includes(currentTile.id));
}

function canAffordCurrentTile(player: Player | undefined, tile: Tile | null): boolean {
  if (!player || !tile) return false;
  return player.money >= (tile.price ?? 0);
}

function computeButtons(gates: ActionGates): StatusPanelButtons {
  const { inRoll, inAction, isJailed, inDoubles, goojCount, playerMoney } = gates;
  const tilePrice = gates.currentTile?.price ?? 0;
  return {
    roll: { visible: inRoll },
    payFine: { visible: inRoll && isJailed, enabled: playerMoney >= 50 },
    useGOOJCard: { visible: inRoll && isJailed && goojCount > 0, count: goojCount },
    declareBankruptcy: { visible: gates.isMyTurn && !!gates.currentPlayer && playerMoney < 0 },
    buy: { visible: inAction && gates.canBuy, price: tilePrice },
    auction: { visible: inAction && gates.canAuction },
    manage: { visible: inAction && !inDoubles },
    rollAgain: { visible: inAction && inDoubles },
    endTurn: { visible: inAction && !inDoubles },
    waiting: { visible: !gates.isMyTurn && !!gates.currentPlayer },
  };
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
  isTokenMoving = false
): StatusPanelActions {
  const gates = computeGates(state, myPlayerId, isTokenMoving);
  return {
    isMyTurn: gates.isMyTurn,
    currentPlayer: gates.currentPlayer,
    currentTile: gates.currentTile,
    canBuy: gates.canBuy,
    canAuction: gates.canAuction,
    buttons: computeButtons(gates),
  };
}

export function useStatusPanelActions(
  state: GameState,
  myPlayerId: string,
  isTokenMoving = false
): StatusPanelActions {
  return useMemo(
    () => getStatusPanelActions(state, myPlayerId, isTokenMoving),
    [state, myPlayerId, isTokenMoving]
  );
}
