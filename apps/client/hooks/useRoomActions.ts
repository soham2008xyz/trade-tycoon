import { useCallback } from 'react';
import type { GameAction } from '@trade-tycoon/game-logic';
import {
  startGame as apiStartGame,
  sendGameAction,
  leaveRoom as apiLeaveRoom,
  removePlayer as apiRemovePlayer,
} from '../components/online-api';
import { clearStoredSession } from '../components/session-storage';
import { analytics } from '../components/analytics';
import type { useOnlineRoom } from './useOnlineRoom';
import type { useRequestGuard } from './useRequestGuard';

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

  const leaveRoom = useCallback(
    async (then: () => void) => {
      // Stop the stream/poll before the leave POST so its own lobby_update
      // (or a poll racing it) can't resurrect state we're abandoning.
      stopSync();

      if (roomId && token) {
        const result = await apiLeaveRoom(serverUrl, roomId, token);
        if (!result.ok) {
          console.error('Leave request failed:', result.error);
        }
      }

      await clearStoredSession();
      then();
    },
    [serverUrl, roomId, token, stopSync]
  );

  const handleLeave = useCallback(() => leaveRoom(onBack), [leaveRoom, onBack]);

  // A finished game can't be restarted from its room (see `canStartNewGame`),
  // so the game-over card's "Back to Menu" goes all the way to the main menu,
  // matching hotseat, instead of the multiplayer menu (#324).
  const handleBackToMainMenu = useCallback(() => leaveRoom(onMainMenu), [leaveRoom, onMainMenu]);

  return {
    handleStartGame,
    handleGameDispatch,
    handleRemovePlayer,
    handleLeave,
    handleBackToMainMenu,
  };
}
