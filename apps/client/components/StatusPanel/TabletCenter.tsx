import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GameOverCard } from './GameOverCard';
import { PlayerList } from './PlayerList';
import { TurnActions, TurnInfo } from './TabletTurn';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

interface Props extends StatusPanelProps {
  /** False when the layout shows the Players list under the board instead. */
  showPlayerList: boolean;
}

const TopButtons: React.FC<{
  isGameOver: boolean;
  onRestart: () => void;
  onShowLog: () => void;
}> = ({ isGameOver, onRestart, onShowLog }) => (
  <View style={styles.topButtons}>
    {!isGameOver && (
      <IconButton title="Restart" icon="restart" onPress={onRestart} color="#666" size="small" />
    )}
    <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
  </View>
);

export const TabletCenter: React.FC<Props> = (props) => {
  const { state, myPlayerId } = props;
  const { currentPlayer, currentTile, buttons, isGameOver } = useStatusPanelActions(
    state,
    myPlayerId,
    props.isTokenMoving
  );

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

        {isGameOver || !currentPlayer ? (
          <GameOverCard
            state={state}
            myPlayerId={myPlayerId}
            isMultiplayer={props.isMultiplayer}
            onNewGame={props.onNewGame}
            onBackToMenu={props.onBackToMenu}
          />
        ) : (
          <>
            <TurnInfo player={currentPlayer} tile={currentTile} panel={props} />
            <TurnActions player={currentPlayer} buttons={buttons} panel={props} />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // The board's center slot is a bounded box, so the panel scrolls when large
  // Dynamic Type outgrows it instead of spilling over the tiles. alignSelf
  // stretch because that slot centres (and so shrink-wraps) its child.
  scroll: { alignSelf: 'stretch', flex: 1 },
  // Top-aligned so the controls do not move as the panel's height changes (#268).
  root: { alignItems: 'center', padding: 20 },
  topButtons: { flexDirection: 'row', gap: 10, marginBottom: 10, zIndex: 20 },
  statusPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
});
