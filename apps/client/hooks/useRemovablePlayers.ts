import React from 'react';
import type { GameUIProps } from '../components/game-ui-props';
import { canRemovePlayer } from '../components/multiplayer-gating';
import type { ShowAlert } from './useGameAlert';

// Stable identity: a fresh `[]` per render would defeat memoization downstream.
export const NO_PLAYERS: readonly string[] = [];

/**
 * Which disconnected players the local user may remove, resolved once here so
 * the panels just render buttons for these ids (the rule lives in
 * `canRemovePlayer`), plus the confirm-then-remove handler behind those buttons.
 * Nothing is removable once the game is over: the server rejects it and the
 * panels show the game-over card instead.
 */
export const useRemovablePlayers = (props: GameUIProps, showAlert: ShowAlert) => {
  const { state, currentPlayerId: myPlayerId, hostId, onRemovePlayer } = props;
  const { isMultiplayer = false, disconnectedPlayerIds = NO_PLAYERS } = props;
  const isGameOver = !!state.winner;

  const removablePlayerIds = React.useMemo(
    () =>
      isGameOver || !onRemovePlayer
        ? NO_PLAYERS
        : state.players
            .filter((p) =>
              canRemovePlayer({
                selfId: myPlayerId,
                hostId,
                targetId: p.id,
                disconnectedPlayerIds,
                isMultiplayer,
              })
            )
            .map((p) => p.id),
    [
      isGameOver,
      onRemovePlayer,
      state.players,
      myPlayerId,
      hostId,
      disconnectedPlayerIds,
      isMultiplayer,
    ]
  );

  const confirmRemove = React.useCallback(
    (targetId: string) => {
      const name = state.players.find((p) => p.id === targetId)?.name ?? 'this player';
      showAlert(
        'Remove Player',
        `Remove ${name} from the game? They've lost connection and won't be able to rejoin. If only one player is left, that player wins.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onRemovePlayer?.(targetId) },
        ]
      );
    },
    [state.players, onRemovePlayer, showAlert]
  );

  return { removablePlayerIds, confirmRemove };
};
