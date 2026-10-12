import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import type { LobbyPlayer } from '@trade-tycoon/game-logic';
import { ConnectionBanner, ConnectionStatusProvider } from '../ui/ConnectionBanner';
import { CustomAlert } from '../ui/Alert';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import type { useOnlineRoom } from '../../hooks/useOnlineRoom';
import type { useRoomActions } from '../../hooks/useRoomActions';
import { createOnlineStyles } from './online-styles';
import { PlayerMarker } from '../PlayerMarker';
import { RoomCodeActions } from './RoomCodeActions';

interface Props {
  room: ReturnType<typeof useOnlineRoom>;
  actions: ReturnType<typeof useRoomActions>;
  busy: boolean;
}

const PlayerRow: React.FC<{ player: LobbyPlayer; isYou: boolean }> = ({ player, isYou }) => {
  const styles = createOnlineStyles(useTheme());
  return (
    <View style={styles.playerRow}>
      <PlayerMarker color={player.color} size={22} style={styles.colorDot} />
      <Text style={styles.playerText}>
        {player.name} {player.isHost ? '(Host)' : ''} {isYou ? '(You)' : ''}
      </Text>
    </View>
  );
};

const LeaveConfirm: React.FC<{ visible: boolean; onLeave: () => void; onClose: () => void }> = ({
  visible,
  onLeave,
  onClose,
}) => (
  <CustomAlert
    visible={visible}
    options={{
      title: 'Leave Room',
      message: 'Are you sure you want to leave this room?',
      buttons: [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: onLeave },
      ],
    }}
    onClose={onClose}
  />
);

/** The waiting room: who has joined, and Start (host) or a waiting note. */
export const OnlineLobby: React.FC<Props> = ({ room, actions, busy }) => {
  const styles = createOnlineStyles(useTheme());
  const { lobbyState, playerId, error } = room;
  const isHost = lobbyState?.players.find((p) => p.id === playerId)?.isHost;
  const canStart = !!lobbyState && lobbyState.players.length >= 2;
  // Leave and Android Back both ask first, so one stray press doesn't drop the
  // player from the room. While the prompt is up its Modal takes Back and just
  // dismisses it.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const askToLeave = useCallback(() => {
    setConfirmLeave(true);
  }, []);
  useAndroidBack(askToLeave);

  return (
    <ConnectionStatusProvider connected={room.connected}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Room: {room.roomId}</Text>
          {room.roomId && <RoomCodeActions roomId={room.roomId} />}
          <Text style={styles.subtitle}>Players:</Text>
          {lobbyState?.players.map((p) => (
            <PlayerRow key={p.id} player={p} isYou={p.id === playerId} />
          ))}

          <View style={styles.spacer} />

          {isHost ? (
            <IconButton
              title="Start Game"
              icon="play"
              onPress={actions.handleStartGame}
              style={styles.button}
              disabled={busy || !canStart}
            />
          ) : (
            <Text style={styles.waitingText}>Waiting for host to start...</Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <IconButton
            title="Leave"
            icon="close"
            onPress={askToLeave}
            style={styles.secondaryButton}
          />
        </View>
        <ConnectionBanner floating />
        <LeaveConfirm
          visible={confirmLeave}
          onLeave={actions.handleLeave}
          onClose={() => {
            setConfirmLeave(false);
          }}
        />
      </View>
    </ConnectionStatusProvider>
  );
};
