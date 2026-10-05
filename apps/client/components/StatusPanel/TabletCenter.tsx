import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { PlayerList } from './PlayerList';
import { TurnPanel } from './TabletTurn';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface Props extends StatusPanelProps {
  /** False when the layout shows the Players list under the board instead. */
  showPlayerList: boolean;
}

interface TopButtonsProps {
  isGameOver: boolean;
  onRestart: () => void;
  onShowLog: () => void;
}

function TopButtons({ isGameOver, onRestart, onShowLog }: TopButtonsProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.topButtons}>
      {!isGameOver && (
        <IconButton
          title="Restart"
          icon="restart"
          onPress={onRestart}
          color={theme.neutralButton}
          size="small"
        />
      )}
      <IconButton
        title="Log"
        icon="script-text"
        onPress={onShowLog}
        color={theme.neutralButton}
        size="small"
      />
    </View>
  );
}

export function TabletCenter(props: Props) {
  const styles = createStyles(useTheme());
  const { state, myPlayerId } = props;
  const actions = useStatusPanelActions(state, myPlayerId, props.isTokenMoving);
  const { currentPlayer, isGameOver } = actions;

  // A finished game with an unresolvable winner has no `currentPlayer` but must
  // still render the game-over card (same fallback as Peek).
  if (!currentPlayer && !isGameOver) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}>
      <TopButtons isGameOver={isGameOver} onRestart={props.onRestart} onShowLog={props.onShowLog} />

      <View style={styles.statusPanel}>
        {props.showPlayerList && (
          <PlayerList
            state={state}
            myPlayerId={myPlayerId}
            activePlayerId={currentPlayer?.id}
            isGameOver={isGameOver}
            disconnectedPlayerIds={props.disconnectedPlayerIds}
            removablePlayerIds={props.removablePlayerIds}
            onRemovePlayer={props.onRemovePlayer}
            onOpenTrade={props.onOpenTrade}
          />
        )}

        <TurnPanel panel={props} actions={actions} />
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The board's center slot is a bounded box, so the panel scrolls when large
    // Dynamic Type outgrows it instead of spilling over the tiles. alignSelf
    // stretch because that slot centres (and so shrink-wraps) its child.
    scroll: { alignSelf: 'stretch', flex: 1 },
    // Top-aligned so the controls do not move as the panel's height changes (#268).
    root: { alignItems: 'center', padding: 20 },
    topButtons: { flexDirection: 'row', gap: 10, marginBottom: 10, zIndex: 20 },
    statusPanel: {
      backgroundColor: theme.panelScrim,
      padding: 15,
      borderRadius: 10,
      width: '100%',
      maxWidth: 300,
      alignItems: 'center',
    },
  });
