import { useCallback } from 'react';
import { leaveRoom as apiLeaveRoom } from '../components/online-api';
import { clearStoredSession } from '../components/session-storage';
import type { useOnlineRoom } from './useOnlineRoom';

interface LeaveRoomOptions {
  serverUrl: string;
  roomId: string;
  token: string | null;
  stopSync: ReturnType<typeof useOnlineRoom>['stopSync'];
  /** Back to the multiplayer menu (lobby/mid-game leave). */
  onBack: () => void;
  /** Back to the main menu, from the game-over card. */
  onMainMenu: () => void;
}

/** Leaving the room: the POST, clearing the stored session, then navigating away. */
export function useLeaveRoom({
  serverUrl,
  roomId,
  token,
  stopSync,
  onBack,
  onMainMenu,
}: LeaveRoomOptions) {
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

  return { handleLeave, handleBackToMainMenu };
}
