import React, { useState } from 'react';
import { Text, Platform } from 'react-native';
import type { GameState } from '@trade-tycoon/game-logic';
import { GameUI } from './GameUI';
import { ConnectionStatusProvider } from './ui/ConnectionBanner';
import { getOnlineServerUrl } from './online-platform';
import { OnlineConnectForm } from './online/OnlineConnectForm';
import { OnlineLobby } from './online/OnlineLobby';
import { OnlineMessage } from './online/OnlineMessage';
import { createOnlineStyles } from './online/online-styles';
import { useOnlineRoom, type OnlineMode } from '../hooks/useOnlineRoom';
import { useRequestGuard } from '../hooks/useRequestGuard';
import { useRoomActions } from '../hooks/useRoomActions';
import { useTheme } from '../hooks/useTheme';

// `null` means: no EXPO_PUBLIC_SERVER_URL configured, production build,
// native platform — there's no safe host to guess (see online-platform.ts).
// The component checks for this before rendering the normal connect flow.
const SERVER_URL = getOnlineServerUrl({
  platform: Platform.OS,
  expoPublicServerUrl: process.env.EXPO_PUBLIC_SERVER_URL,
  isDev: __DEV__,
});

interface OnlineGameProps {
  /** Back to the multiplayer menu (form back buttons, lobby/mid-game leave). */
  onBack: () => void;
  /** Back to the main menu, from the game-over card. */
  onMainMenu: () => void;
  initialMode: OnlineMode;
}

interface SessionProps extends OnlineGameProps {
  serverUrl: string;
}

interface GameScreenProps {
  state: GameState;
  room: ReturnType<typeof useOnlineRoom>;
  actions: ReturnType<typeof useRoomActions>;
}

const OnlineGameScreen: React.FC<GameScreenProps> = ({ state, room, actions }) => {
  const [uiToastMessage, setUiToastMessage] = useState<string | null>(null);
  return (
    <ConnectionStatusProvider connected={room.connected}>
      <GameUI
        state={state}
        currentPlayerId={room.playerId || ''}
        onDispatch={actions.handleGameDispatch}
        uiToastMessage={uiToastMessage ?? room.error}
        setUiToastMessage={setUiToastMessage}
        onLeaveGame={actions.handleLeave}
        onBackToMenu={actions.handleBackToMainMenu}
        isMultiplayer={true}
        disconnectedPlayerIds={room.disconnectedPlayerIds}
        hostId={room.lobbyState?.players.find((p) => p.isHost)?.id}
        onRemovePlayer={actions.handleRemovePlayer}
      />
    </ConnectionStatusProvider>
  );
};

/** Online play once a server address is known: connect, lobby, then game. */
const OnlineSession: React.FC<SessionProps> = ({ serverUrl, onBack, onMainMenu, initialMode }) => {
  const styles = createOnlineStyles(useTheme());
  const room = useOnlineRoom(serverUrl, initialMode, onBack);
  const guard = useRequestGuard();
  const actions = useRoomActions({ serverUrl, room, run: guard.run, onBack, onMainMenu });
  const { step, gameState } = room;

  if (step === 'resuming') {
    return (
      <OnlineMessage
        title="Resuming…"
        message="Reconnecting to your last room. If it can't be found we'll send you back."
      />
    );
  }

  if (step === 'connect') {
    return (
      <OnlineConnectForm
        mode={initialMode}
        serverUrl={serverUrl}
        room={room}
        guard={guard}
        onBack={onBack}
      />
    );
  }

  if (step === 'lobby') {
    return <OnlineLobby room={room} actions={actions} busy={guard.busy} />;
  }

  if (step === 'game' && gameState) {
    return <OnlineGameScreen state={gameState} room={room} actions={actions} />;
  }

  return <Text style={styles.subtitle}>Loading...</Text>;
};

export const OnlineGame: React.FC<OnlineGameProps> = (props) => {
  // Deliberately `=== null`, not a falsy check: `''` is the intended
  // same-origin sentinel for an unconfigured production web build (see
  // online-platform.ts) and must be treated as configured.
  if (SERVER_URL === null) {
    return (
      <OnlineMessage
        title="Online Play Unavailable"
        message="This build isn't configured with a server address, so online play can't connect. Contact the app developer."
        onBack={props.onBack}
      />
    );
  }
  return <OnlineSession {...props} serverUrl={SERVER_URL} />;
};
