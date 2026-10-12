import React from 'react';
import type { GameUIProps } from '../components/game-ui-props';
import { getBoardBackAction } from '../components/back-press';
import { useAndroidBack } from './useAndroidBack';
import type { ShowAlert } from './useGameAlert';

/** The ways out of the game: declaring bankruptcy, leaving/restarting, and Android Back. */
export const useExitActions = (props: GameUIProps, showAlert: ShowAlert) => {
  const { currentPlayerId: myPlayerId, onDispatch, onLeaveGame, onBackToMenu } = props;
  const isGameOver = !!props.state.winner;

  const onDeclareBankruptcy = React.useCallback(() => {
    if (myPlayerId) {
      showAlert(
        'Declare Bankruptcy',
        'Are you sure you want to declare bankruptcy? You will be removed from the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              onDispatch({ type: 'DECLARE_BANKRUPTCY', playerId: myPlayerId });
            },
          },
        ]
      );
    }
  }, [myPlayerId, onDispatch, showAlert]);

  const onRestart = React.useCallback(() => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  }, [onLeaveGame, showAlert]);

  // Android hardware Back on the board (#315): without it the app exits and a
  // hotseat game is lost. Mid-game it asks first; after a win it goes to the menu.
  const handleBackPress = React.useCallback(() => {
    if (getBoardBackAction(isGameOver) === 'back-to-menu') {
      (onBackToMenu ?? onLeaveGame)();
    } else {
      onRestart();
    }
  }, [isGameOver, onBackToMenu, onLeaveGame, onRestart]);
  useAndroidBack(handleBackPress);

  return { onDeclareBankruptcy, onRestart };
};
