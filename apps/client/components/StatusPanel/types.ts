import type { GameState, Player, Tile, TradeOffer } from '@trade-tycoon/game-logic';

export interface StatusPanelProps {
  state: GameState;
  myPlayerId: string;
  isMultiplayer: boolean;

  onRoll: () => void;
  onBuy: () => void;
  onDeclineBuy: () => void;
  onEndTurn: () => void;
  onRollAgain: () => void;
  onPayFine: () => void;
  onUseGOOJCard: () => void;
  onDeclareBankruptcy: () => void;
  onShowLog: () => void;
  onRestart: () => void;
  onOpenPropertyManager: () => void;
  onOpenTrade: (targetPlayerId: string) => void;

  /**
   * Indicates a player token is currently animating across the board — we
   * hide the action buttons during travel so the user can't dispatch a
   * follow-up action before the previous one has visually settled.
   */
  isTokenMoving: boolean;
}

export type { GameState, Player, Tile, TradeOffer };
