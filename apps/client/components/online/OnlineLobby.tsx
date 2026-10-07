import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Share, AccessibilityInfo } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { LobbyPlayer } from '@trade-tycoon/game-logic';
import { ConnectionBanner, ConnectionStatusProvider } from '../ui/ConnectionBanner';
import { CustomAlert } from '../ui/Alert';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import type { useOnlineRoom } from '../../hooks/useOnlineRoom';
import type { useRoomActions } from '../../hooks/useRoomActions';
import { buildRoomShareMessage, COPIED_FEEDBACK_MS } from '../online-room-share';
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

// `Share.share` on react-native-web rejects when the browser has no Web Share
// API (most desktop browsers), so only offer the button where it can work.
const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!navigator.share);

const COPIED_MESSAGE = 'Room code copied';

/** The room code with Copy and Share, so the host needn't read it out or retype it. */
const RoomCodeActions: React.FC<{ roomId: string }> = ({ roomId }) => {
  const styles = createOnlineStyles(useTheme());
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const handleCopy = async () => {
    let saved = false;
    try {
      // On web this resolves to `false` (rather than rejecting) when the write fails;
      // native always resolves `true`.
      saved = await Clipboard.setStringAsync(roomId);
    } catch {
      // Clipboard can be blocked (web without permission); the code stays visible to read out.
    }
    if (!saved) return;
    setCopied(true);
    // The button text change alone isn't announced to a screen reader (no focus move).
    AccessibilityInfo.announceForAccessibility(COPIED_MESSAGE);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_MS);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: buildRoomShareMessage(roomId) });
    } catch {
      // Web rejects when the user closes the share sheet; nothing to recover.
    }
  };

  return (
    <View style={styles.roomCodeRow}>
      <IconButton
        title={copied ? 'Copied' : 'Copy'}
        icon={copied ? 'check' : 'content-copy'}
        size="small"
        onPress={handleCopy}
        style={styles.roomCodeButton}
        accessibilityLabel={copied ? COPIED_MESSAGE : 'Copy room code'}
      />
      {/* `announceForAccessibility` is a no-op in react-native-web, so the alert role is
          what makes web screen readers read it (same as Toast). Native is announced above. */}
      {copied && Platform.OS === 'web' && (
        <Text role="alert" style={styles.visuallyHidden}>
          {COPIED_MESSAGE}
        </Text>
      )}
      {canShare && (
        <IconButton
          title="Share"
          icon="share-variant"
          size="small"
          onPress={handleShare}
          style={styles.roomCodeButton}
          accessibilityLabel="Share room code"
        />
      )}
    </View>
  );
};

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
        <CustomAlert
          visible={confirmLeave}
          options={{
            title: 'Leave Room',
            message: 'Are you sure you want to leave this room?',
            buttons: [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: actions.handleLeave },
            ],
          }}
          onClose={() => {
            setConfirmLeave(false);
          }}
        />
      </View>
    </ConnectionStatusProvider>
  );
};
