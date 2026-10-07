import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { limitPlayerNameInput } from '@trade-tycoon/game-logic';
import { IconButton } from '../ui/IconButton';
import { KeyboardAwareScreen } from '../ui/KeyboardAwareScreen';
import { validateConnectForm } from '../online-form';
import { createRoom as apiCreateRoom, joinRoom as apiJoinRoom } from '../online-api';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import type { OnlineMode, useOnlineRoom } from '../../hooks/useOnlineRoom';
import type { useRequestGuard } from '../../hooks/useRequestGuard';
import { createOnlineStyles } from './online-styles';

interface Props {
  mode: OnlineMode;
  serverUrl: string;
  room: ReturnType<typeof useOnlineRoom>;
  guard: ReturnType<typeof useRequestGuard>;
  onBack: () => void;
}

function useConnectForm({ mode, serverUrl, room, guard }: Props) {
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

const FormInput: React.FC<TextInputProps> = (props) => {
  const theme = useTheme();
  const styles = createOnlineStyles(theme);
  return (
    <TextInput
      style={styles.input}
      placeholderTextColor={theme.textMuted}
      keyboardAppearance={theme.scheme}
      {...props}
    />
  );
};

/** The name (and, to join, room code) form shown before entering a room. */
export const OnlineConnectForm: React.FC<Props> = (props) => {
  const { mode, guard, onBack } = props;
  const styles = createOnlineStyles(useTheme());
  const form = useConnectForm(props);
  const isCreate = mode === 'create';
  useAndroidBack(onBack);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{isCreate ? 'Create Room' : 'Join Room'}</Text>

        <FormInput
          nativeID="online-player-name"
          accessibilityLabel="Your name"
          placeholder="Your Name"
          value={form.playerName}
          onChangeText={form.onNameChange}
        />

        {mode === 'join' && (
          <FormInput
            nativeID="online-room-code"
            accessibilityLabel="Room code"
            placeholder="Room Code (e.g. ABCD123)"
            value={form.inputRoomId}
            onChangeText={form.onRoomCodeChange}
            autoCapitalize="characters"
          />
        )}

        {form.message && <Text style={styles.error}>{form.message}</Text>}

        <View style={styles.buttonContainer}>
          <IconButton
            title={isCreate ? 'Create' : 'Join'}
            icon={isCreate ? 'plus' : 'login'}
            onPress={form.submit}
            style={styles.button}
            disabled={guard.busy}
          />
          <IconButton
            title="Back"
            icon="arrow-left"
            onPress={onBack}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </KeyboardAwareScreen>
  );
};
