import type { GameState, Player, Tile, TradeOffer } from '@trade-tycoon/game-logic';

export interface StatusPanelProps {
  state: GameState;
  myPlayerId: string;
  isMultiplayer: boolean;

  /**
   * Players the server reports as unheard-from (online only; always empty in
   * hotseat, which has no presence).
   */
  disconnectedPlayerIds: readonly string[];
  /**
   * The subset of `disconnectedPlayerIds` the local user may remove — already
   * resolved through `canRemovePlayer`, so panels render a button for exactly
   * these ids and never re-implement the rule.
   */
  removablePlayerIds: readonly string[];
  /** Ask to remove a disconnected player (the game UI confirms first). */
  onRemovePlayer: (_targetPlayerId: string) => void;

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
  /** Leave the finished game for the menu, with no confirm (nothing left to lose). */
  onBackToMenu: () => void;
  /** Hotseat only: go straight to player setup. Omitted online (see `canStartNewGame`). */
  onNewGame?: () => void;
  onOpenPropertyManager: () => void;
  onOpenTrade: (_targetPlayerId: string) => void;

  /**
   * Indicates a player token is currently animating across the board — we
   * hide the action buttons during travel so the user can't dispatch a
   * follow-up action before the previous one has visually settled.
   */
  isTokenMoving: boolean;
}

export type { GameState, Player, Tile, TradeOffer };
