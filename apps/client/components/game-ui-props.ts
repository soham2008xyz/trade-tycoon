import type { GameAction, GameState } from '@trade-tycoon/game-logic';

export interface GameUIProps {
  state: GameState;
  currentPlayerId: string;
  onDispatch: (action: GameAction) => void;
  uiToastMessage: string | null;
  setUiToastMessage: (msg: string | null) => void;
  onLeaveGame: () => void;
  /** Game-over "Back to Menu"; falls back to `onLeaveGame` when not given. */
  onBackToMenu?: () => void;
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
