import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Player } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import type { StatusPanelActions } from '../../hooks/useStatusPanelActions';
import { GameOverCard } from './GameOverCard';
import { TurnActions } from './TabletTurnActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';
import { PlayerMarker } from '../PlayerMarker';
import { GameTimerBadge } from '../ui/TurnTimerBadge';

interface TurnInfoProps {
  player: Player;
  /** Name of the tile the player stands on; undefined when unknown. */
  tileName?: string;
  /** Group key of that tile, for its colour swatch; undefined for non-streets. */
  tileGroup?: string;
  panel: StatusPanelProps;
}

/** Who is playing, where they stand and the dice, for the tablet board centre. */
function TurnInfo({ player, tileName, tileGroup, panel }: TurnInfoProps) {
  const styles = createStyles(useTheme());
  // Looked up through entries(), not GROUP_COLORS[tileGroup], to avoid a generic object injection sink.
  const groupColor = Object.entries(GROUP_COLORS).find(([group]) => group === tileGroup)?.[1];
  return (
    <View style={styles.gameInfo}>
      <View style={styles.currentPlayerInfo}>
        <Text style={styles.statusText}>Current: </Text>
        <PlayerMarker color={player.color} size={16} style={styles.playerColor} />
        <Text style={styles.statusText}>{player.name}</Text>
        <GOOJBadge count={player.getOutOfJailCards} />
      </View>
      <GameTimerBadge state={panel.state} myPlayerId={panel.myPlayerId} />
      <View style={styles.currentTileInfo}>
        <Text style={styles.statusText}>Position: </Text>
        {!panel.isTokenMoving && groupColor && (
          <View style={[styles.tileColor, { backgroundColor: groupColor }]} />
        )}
        <Text style={[styles.statusText, styles.positionText]}>
          {panel.isTokenMoving ? '...' : getPlayerPositionLabel(player, tileName)}
        </Text>
      </View>
      <JailStatus player={player} showHint />
      <DiceSlot panel={panel} />
    </View>
  );
}

/** Reserved even before the first roll so the dice appearing does not push the buttons below down (#268). */
function DiceSlot({ panel }: { panel: StatusPanelProps }) {
  const styles = createStyles(useTheme());
  return (
    <View style={styles.diceSlot}>
      {panel.state.phase === 'action' && (
        <Dice
          value1={panel.state.dice[0]}
          value2={panel.state.dice[1]}
          isRolling={panel.isTokenMoving}
        />
      )}
    </View>
  );
}

interface TurnPanelProps {
  panel: StatusPanelProps;
  actions: StatusPanelActions;
}

/** Everything under the Players list: the game-over card, or the turn info and its buttons. */
export function TurnPanel({ panel, actions }: TurnPanelProps) {
  const { currentPlayer, currentTile, buttons, isGameOver } = actions;
  if (isGameOver || !currentPlayer) {
    return (
      <GameOverCard
        state={panel.state}
        myPlayerId={panel.myPlayerId}
        isMultiplayer={panel.isMultiplayer}
        onNewGame={panel.onNewGame}
        onBackToMenu={panel.onBackToMenu}
      />
    );
  }
  return (
    <>
      <TurnInfo
        player={currentPlayer}
        tileName={currentTile?.name}
        tileGroup={currentTile?.group}
        panel={panel}
      />
      <TurnActions player={currentPlayer} buttons={buttons} panel={panel} />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    playerColor: { marginRight: 6 },
    gameInfo: { marginBottom: 15, alignItems: 'center', gap: 4 },
    currentPlayerInfo: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: 6,
    },
    currentTileInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: 14, color: theme.textPrimary },
    // Shrinks so a long tile name wraps in place at large Dynamic Type instead
    // of overflowing the panel (same pattern as Peek).
    positionText: { flexShrink: 1 },
    tileColor: {
      width: 12,
      height: 12,
      marginRight: 6,
      borderWidth: 1,
      borderColor: theme.outline,
    },
    // Dice are 40px tall plus padding; reserve that height before they appear.
    diceSlot: { minHeight: 50, justifyContent: 'center' },
  });
