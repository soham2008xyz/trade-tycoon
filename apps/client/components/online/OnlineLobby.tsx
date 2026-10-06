import React from 'react';
import { View, Text } from 'react-native';
import type { LobbyPlayer } from '@trade-tycoon/game-logic';
import { ConnectionBanner, ConnectionStatusProvider } from '../ui/ConnectionBanner';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import type { useOnlineRoom } from '../../hooks/useOnlineRoom';
import type { useRoomActions } from '../../hooks/useRoomActions';
import { createOnlineStyles } from './online-styles';

interface Props {
  room: ReturnType<typeof useOnlineRoom>;
  actions: ReturnType<typeof useRoomActions>;
  busy: boolean;
}

const PlayerRow: React.FC<{ player: LobbyPlayer; isYou: boolean }> = ({ player, isYou }) => {
  const styles = createOnlineStyles(useTheme());
  return (
    <View style={styles.playerRow}>
      <View style={[styles.colorDot, { backgroundColor: player.color }]} />
      <Text style={styles.playerText}>
        {player.name} {player.isHost ? '(Host)' : ''} {isYou ? '(You)' : ''}
      </Text>
    </View>
  );
};

/** The waiting room: who has joined, and Start (host) or a waiting note. */
export const OnlineLobby: React.FC<Props> = ({ room, actions, busy }) => {
  const styles = createOnlineStyles(useTheme());
  const { lobbyState, playerId, error } = room;
  const isHost = lobbyState?.players.find((p) => p.id === playerId)?.isHost;
  const canStart = !!lobbyState && lobbyState.players.length >= 2;

  return (
    <ConnectionStatusProvider connected={room.connected}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Room: {room.roomId}</Text>
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
            onPress={actions.handleLeave}
            style={styles.secondaryButton}
          />
        </View>
        <ConnectionBanner floating />
      </View>
    </ConnectionStatusProvider>
  );
};
