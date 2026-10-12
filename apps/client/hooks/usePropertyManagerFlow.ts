import React from 'react';
import type { GameAction, Player } from '@trade-tycoon/game-logic';

interface PropertyManagerFlowParams {
  myPlayerId: string;
  myPlayer: Player | undefined;
  isGameOver: boolean;
  onDispatch: (action: GameAction) => void;
}

/**
 * The Manage Properties modal's visibility and its build/sell/mortgage handlers.
 * Property management is always attributed to the local player, not whoever's
 * turn it currently is — the reducer already rejects these outside the actor's
 * own turn, so sending the true actor's id lets that turn check do its job
 * instead of silently attributing the action to the current player if the
 * panel is still open when the turn changes underneath it.
 */
export const usePropertyManagerFlow = (params: PropertyManagerFlowParams) => {
  const { myPlayerId, myPlayer, isGameOver, onDispatch } = params;
  const [shown, setShown] = React.useState(false);

  // The reducer ignores everything but RESET_GAME/DISMISS_* once a winner is
  // set, so a panel left open (or opened) would do nothing.
  const visible = !!myPlayer && shown && !isGameOver;
  const open = React.useCallback(() => {
    setShown(true);
  }, []);
  const close = () => {
    setShown(false);
  };
  const onBuild = (id: string) => {
    onDispatch({ type: 'BUILD_HOUSE', playerId: myPlayerId, propertyId: id });
  };
  const onSell = (id: string) => {
    onDispatch({ type: 'SELL_HOUSE', playerId: myPlayerId, propertyId: id });
  };
  const onMortgage = (id: string) => {
    onDispatch({ type: 'MORTGAGE_PROPERTY', playerId: myPlayerId, propertyId: id });
  };
  const onUnmortgage = (id: string) => {
    onDispatch({ type: 'UNMORTGAGE_PROPERTY', playerId: myPlayerId, propertyId: id });
  };

  return { visible, open, close, onBuild, onSell, onMortgage, onUnmortgage };
};
