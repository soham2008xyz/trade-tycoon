import React from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../Board';
import { getBoardSize, getPlayerStripHeight } from '../board-size';
import { PlayerList } from '../StatusPanel/PlayerList';
import { TabletCenter } from '../StatusPanel/TabletCenter';
import type { StatusPanelProps } from '../StatusPanel/types';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';

interface Props extends StatusPanelProps {
  onTilePress: (_tileId: string) => void;
  onTokenMovingChange: (_isMoving: boolean) => void;
}

export const TabletGameLayout: React.FC<Props> = (props) => {
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = React.useState<{ width: number; height: number } | null>(null);
  const { currentPlayer, isGameOver } = useStatusPanelActions(
    props.state,
    props.myPlayerId,
    props.isTokenMoving
  );

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  // A tall frame (iPad portrait) leaves a band under the square board. The
  // Players list moves there, which also frees the board centre (#268). Unmeasured
  // or wide frames keep the list in the centre.
  const showStrip = frame !== null && getPlayerStripHeight(frame.width, frame.height) > 0;
  const boardSize = frame ? getBoardSize(frame.width, frame.height) : 0;

  return (
    // Outer wrapper carries the status-bar inset (iPad shows one too) so the inner
    // onLayout frame, which sizes the Board, excludes it (#250).
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={[styles.root, showStrip && styles.rootWithStrip]} onLayout={onLayout}>
        <Board
          players={props.state.players}
          availableWidth={frame?.width}
          availableHeight={frame?.height}
          onTilePress={props.onTilePress}
          onTokenMovingChange={props.onTokenMovingChange}
          slot={<TabletCenter {...props} showPlayerList={!showStrip} />}
        />
        {showStrip && (
          <ScrollView
            style={[styles.strip, { width: boardSize }]}
            contentContainerStyle={styles.stripContent}
          >
            <PlayerList
              state={props.state}
              myPlayerId={props.myPlayerId}
              activePlayerId={currentPlayer?.id}
              isGameOver={isGameOver}
              disconnectedPlayerIds={props.disconnectedPlayerIds}
              removablePlayerIds={props.removablePlayerIds}
              onRemovePlayer={props.onRemovePlayer}
              onOpenTrade={props.onOpenTrade}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  rootWithStrip: { justifyContent: 'flex-start' },
  strip: {
    flex: 1,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  stripContent: { padding: 15 },
});
