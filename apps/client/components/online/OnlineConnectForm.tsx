import React from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { KeyboardAwareScreen } from '../ui/KeyboardAwareScreen';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useConnectForm } from '../../hooks/useConnectForm';
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
