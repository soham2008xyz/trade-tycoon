import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Share, AccessibilityInfo } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import { buildRoomShareMessage, COPIED_FEEDBACK_MS } from '../online-room-share';
import { createOnlineStyles } from './online-styles';

// `Share.share` on react-native-web rejects when the browser has no Web Share
// API (most desktop browsers), so only offer the button where it can work.
const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!navigator.share);

const COPIED_MESSAGE = 'Room code copied';

/** The room code with Copy and Share, so the host needn't read it out or retype it. */
export const RoomCodeActions: React.FC<{ roomId: string }> = ({ roomId }) => {
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
