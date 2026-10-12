import { useState } from 'react';
import { limitPlayerNameInput } from '@trade-tycoon/game-logic';
import { validateConnectForm } from '../components/online-form';
import { analytics } from '../components/analytics';
import { createRoom as apiCreateRoom, joinRoom as apiJoinRoom } from '../components/online-api';
import type { OnlineMode, useOnlineRoom } from './useOnlineRoom';
import type { useRequestGuard } from './useRequestGuard';

interface ConnectFormOptions {
  mode: OnlineMode;
  serverUrl: string;
  room: ReturnType<typeof useOnlineRoom>;
  guard: ReturnType<typeof useRequestGuard>;
}

/** State and submit handlers for the create/join form shown before entering a room. */
export function useConnectForm({ mode, serverUrl, room, guard }: ConnectFormOptions) {
  const [playerName, setPlayerName] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  // Form-validation message, kept apart from `error` (server/lobby errors,
  // which auto-expire): it's cleared on edit and only rendered on the connect
  // screen, so it can't linger or leak into the lobby (#252).
  const [formError, setFormError] = useState<string | null>(null);
  const { enterLobby, setTransientError } = room;

  const handleCreate = async () => {
    const validationError = validateConnectForm('create', playerName, inputRoomId);
    setFormError(validationError);
    if (validationError) return;
    await guard.run(async () => {
      const result = await apiCreateRoom(serverUrl, playerName.trim());
      if (!result.ok) {
        setTransientError(result.error);
        return;
      }
      analytics.trackEvent('create_room');
      await enterLobby(result.data);
    });
  };

  const handleJoin = async () => {
    const validationError = validateConnectForm('join', playerName, inputRoomId);
    setFormError(validationError);
    if (validationError) return;
    const targetRoomId = inputRoomId.trim().toUpperCase();
    await guard.run(async () => {
      const result = await apiJoinRoom(serverUrl, targetRoomId, playerName.trim());
      if (!result.ok) {
        setTransientError(result.error);
        return;
      }
      // Server already normalized the room id, but make sure we use the
      // exact value it returned for SSE / future requests.
      analytics.trackEvent('join_room');
      await enterLobby({ ...result.data, roomId: result.data.roomId || targetRoomId });
    });
  };

  const onNameChange = (text: string) => {
    setPlayerName(limitPlayerNameInput(text));
    setFormError(null);
  };
  const onRoomCodeChange = (text: string) => {
    setInputRoomId(text.toUpperCase());
    setFormError(null);
  };

  return {
    playerName,
    inputRoomId,
    message: formError ?? room.error,
    onNameChange,
    onRoomCodeChange,
    submit: mode === 'create' ? handleCreate : handleJoin,
  };
}
