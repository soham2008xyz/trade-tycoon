import { useCallback } from 'react';
import type { GameAction } from '@trade-tycoon/game-logic';
import {
  startGame as apiStartGame,
  sendGameAction,
  removePlayer as apiRemovePlayer,
} from '../components/online-api';
import { analytics } from '../components/analytics';
import type { useOnlineRoom } from './useOnlineRoom';
import type { useRequestGuard } from './useRequestGuard';
import { useLeaveRoom } from './useLeaveRoom';

interface RoomActionsOptions {
  serverUrl: string;
  room: ReturnType<typeof useOnlineRoom>;
  run: ReturnType<typeof useRequestGuard>['run'];
  /** Back to the multiplayer menu (lobby/mid-game leave). */
  onBack: () => void;
  /** Back to the main menu, from the game-over card. */
  onMainMenu: () => void;
}

/** Lobby and in-game requests for the room we're in. */
export function useRoomActions(options: RoomActionsOptions) {
  const { serverUrl, run, onBack, onMainMenu } = options;
  const { roomId, token, setTransientError, stopSync } = options.room;

  const handleStartGame = async () => {
    if (!token || !roomId) return;
    await run(async () => {
      const result = await apiStartGame(serverUrl, roomId, token);
      if (!result.ok) {
        setTransientError(result.error);
      } else {
        analytics.trackEvent('start_online_game');
      }
      // The actual transition to step='game' happens via the SSE stream when
      // it delivers the lobby_update with status='game'.
    });
  };

  // Stable identity matters for the callbacks handed to GameUI
  // (onDispatch/onLeaveGame/…): they feed its memoized sharedProps, and a
  // fresh closure per render would defeat the Board/Tile memoization downstream.
  const handleGameDispatch = useCallback(
    async (action: GameAction) => {
      if (!token || !roomId) return;
      await run(async () => {
        const result = await sendGameAction(serverUrl, roomId, token, action);
        if (!result.ok) {
          setTransientError(result.error);
        }
      });
    },
    [serverUrl, roomId, token, run, setTransientError]
  );

  const handleRemovePlayer = useCallback(
    async (targetPlayerId: string) => {
      if (!token || !roomId) return;
      await run(async () => {
        const result = await apiRemovePlayer(serverUrl, roomId, token, targetPlayerId);
        if (!result.ok) {
          // e.g. 409 "Player is still connected" if they came back meanwhile.
          setTransientError(result.error);
        }
        // On success the resulting lobby_update arrives through the sync.
      });
    },
    [serverUrl, roomId, token, run, setTransientError]
  );

  const { handleLeave, handleBackToMainMenu } = useLeaveRoom({
    serverUrl,
    roomId,
    token,
    stopSync,
    onBack,
    onMainMenu,
  });

  return {
    handleStartGame,
    handleGameDispatch,
    handleRemovePlayer,
    handleLeave,
    handleBackToMainMenu,
  };
}
