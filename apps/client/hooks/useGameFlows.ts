import type { GameUIProps } from '../components/game-ui-props';
import { getToastHost } from '../components/toast-host';
import { useGameAlert } from './useGameAlert';
import { useGameFeedback } from './useGameFeedback';
import { useExitActions } from './useExitActions';
import { usePropertyManagerFlow } from './usePropertyManagerFlow';
import { NO_PLAYERS, useRemovablePlayers } from './useRemovablePlayers';
import { useScreenState } from './useScreenState';
import { useTradeFlow } from './useTradeFlow';
import { useTurnActions } from './useTurnActions';

/**
 * All of the game screen's state and handlers, grouped by the surface they
 * belong to. `GameUI` only wires these into the layout and the modals.
 */
export const useGameFlows = (props: GameUIProps) => {
  const { state, currentPlayerId: myPlayerId, onDispatch } = props;
  const { isMultiplayer = false, disconnectedPlayerIds = NO_PLAYERS } = props;
  const isGameOver = !!state.winner;
  const myPlayer = state.players.find((p) => p.id === myPlayerId);

  const alert = useGameAlert();
  const screen = useScreenState();

  const turn = useTurnActions({ state, onDispatch });
  const exit = useExitActions(props, alert.showAlert);
  const trade = useTradeFlow({ state, selfId: myPlayerId, isGameOver, onDispatch });
  const manager = usePropertyManagerFlow({ myPlayerId, myPlayer, isGameOver, onDispatch });
  const removal = useRemovablePlayers(props, alert.showAlert);
  const feedback = useGameFeedback(state, isMultiplayer, onDispatch);

  // A `Modal` covers the whole app, so while one is open the toasts render
  // inside the topmost one instead of at the screen root, or a rejection (a
  // build, an online 409 on a trade or bid) would be hidden behind it (#323).
  // Each flag mirrors the modal's own mount guard as well as its `visible`, so
  // the toasts are never handed to a modal that renders nothing.
  const toastHost = getToastHost({
    auction: state.phase === 'auction' && !!state.auction,
    trade: trade.visible,
    manage: manager.visible,
    log: screen.logVisible,
    tile: !!screen.selectedTile,
  });

  return {
    ...screen,
    myPlayer,
    isMultiplayer,
    disconnectedPlayerIds,
    alert,
    turn,
    exit,
    trade,
    manager,
    removal,
    feedback,
    toastHost,
  };
};

export type GameFlows = ReturnType<typeof useGameFlows>;
