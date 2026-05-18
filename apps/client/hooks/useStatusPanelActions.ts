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

/** Whether the tile at the active player's position is buyable and unowned. */
function isPropertyUnowned(state: GameState, player: Player, tile: Tile): boolean {
  if (state.phase !== 'action' || !isTileBuyable(tile)) return false;
  return !state.players.some((p) => p.properties.includes(tile.id));
}

/** Whether the active player has enough money to cover the tile's listed price. */
function canAffordTile(player: Player, tile: Tile): boolean {
  return player.money >= (tile.price ?? 0);
}

interface ActionContext {
  state: GameState;
  player: Player;
  tile: Tile;
  isMyTurn: boolean;
  isTokenMoving: boolean;
  propertyUnowned: boolean;
  canAfford: boolean;
}

/**
 * Pre-computed booleans for "is roll/action phase active for me, with no
 * animation blocking input". Used as a common gate by most button rules.
 */
function inRoll(ctx: ActionContext): boolean {
  return ctx.isMyTurn && ctx.state.phase === 'roll';
}
function inAction(ctx: ActionContext): boolean {
  return ctx.isMyTurn && ctx.state.phase === 'action' && !ctx.isTokenMoving;
}
function inDoubles(ctx: ActionContext): boolean {
  return ctx.state.doublesCount > 0;
}

function rollButton(ctx: ActionContext): VisibleButton {
  return { visible: inRoll(ctx) };
}
function payFineButton(ctx: ActionContext): PayFineButton {
  return { visible: inRoll(ctx) && ctx.player.isInJail, enabled: ctx.player.money >= 50 };
}
function useGOOJButton(ctx: ActionContext): UseGOOJButton {
  const count = ctx.player.getOutOfJailCards;
  return { visible: inRoll(ctx) && ctx.player.isInJail && count > 0, count };
}
function declareBankruptcyButton(ctx: ActionContext): VisibleButton {
  return { visible: ctx.isMyTurn && ctx.player.money < 0 };
}
function buyButton(ctx: ActionContext): BuyButton {
  return {
    visible: inAction(ctx) && ctx.propertyUnowned && ctx.canAfford,
    price: ctx.tile.price ?? 0,
  };
}
function auctionButton(ctx: ActionContext): VisibleButton {
  return { visible: inAction(ctx) && ctx.propertyUnowned };
}
function manageButton(ctx: ActionContext): VisibleButton {
  return { visible: inAction(ctx) && !inDoubles(ctx) };
}
function rollAgainButton(ctx: ActionContext): VisibleButton {
  return { visible: inAction(ctx) && inDoubles(ctx) };
}
function endTurnButton(ctx: ActionContext): VisibleButton {
  return { visible: inAction(ctx) && !inDoubles(ctx) };
}
function waitingButton(ctx: ActionContext): VisibleButton {
  return { visible: !ctx.isMyTurn };
}

function buildButtons(ctx: ActionContext): StatusPanelButtons {
  return {
    roll: rollButton(ctx),
    payFine: payFineButton(ctx),
    useGOOJCard: useGOOJButton(ctx),
    declareBankruptcy: declareBankruptcyButton(ctx),
    buy: buyButton(ctx),
    auction: auctionButton(ctx),
    manage: manageButton(ctx),
    rollAgain: rollAgainButton(ctx),
    endTurn: endTurnButton(ctx),
    waiting: waitingButton(ctx),
  };
}

/** All buttons hidden — used when the active player can't be resolved. */
function emptyButtons(): StatusPanelButtons {
  const hidden: VisibleButton = { visible: false };
  return {
    roll: hidden,
    payFine: { ...hidden, enabled: false },
    useGOOJCard: { ...hidden, count: 0 },
    declareBankruptcy: hidden,
    buy: { ...hidden, price: 0 },
    auction: hidden,
    manage: hidden,
    rollAgain: hidden,
    endTurn: hidden,
    waiting: hidden,
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
  const player = state.players.find((p) => p.id === state.currentPlayerId);
  const tile = player ? BOARD[player.position] : null;
  const isMyTurn = state.currentPlayerId === myPlayerId;

  if (!player || !tile) {
    return {
      isMyTurn,
      currentPlayer: player,
      currentTile: tile,
      canBuy: false,
      canAuction: false,
      buttons: emptyButtons(),
    };
  }

  const propertyUnowned = isPropertyUnowned(state, player, tile);
  const canAfford = canAffordTile(player, tile);
  const ctx: ActionContext = {
    state,
    player,
    tile,
    isMyTurn,
    isTokenMoving,
    propertyUnowned,
    canAfford,
  };

  return {
    isMyTurn,
    currentPlayer: player,
    currentTile: tile,
    canBuy: propertyUnowned && canAfford,
    canAuction: propertyUnowned,
    buttons: buildButtons(ctx),
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
