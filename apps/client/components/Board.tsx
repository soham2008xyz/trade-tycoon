import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { BOARD, Player } from '@trade-tycoon/game-logic';
import { Tile } from './Tile';
import { PlayerToken } from './PlayerToken';

const CORNER_SIZE_PCT = 14;
const COMPACT_TILE_THRESHOLD = 500;

interface Props {
  players: Player[];
  /** React node rendered inside the board's center hole. Pass `null` on phone. */
  slot?: React.ReactNode;
  availableWidth?: number;
  availableHeight?: number;
  /** Tile-tap handler. The host (GameUI) opens TileInfoModal. */
  onTilePress: (_tileId: string) => void;
  /** Notifies the host when a player token starts/finishes animating. */
  onTokenMovingChange?: (_isMoving: boolean) => void;
}

const BoardComponent: React.FC<Props> = ({
  players,
  slot,
  availableWidth,
  availableHeight,
  onTilePress,
  onTokenMovingChange,
}) => {
  const { width, height } = useWindowDimensions();
  const boardWidth = availableWidth ?? width;
  const boardHeight = availableHeight ?? height;
  const size = Math.max(320, Math.min(boardWidth, boardHeight) - 20);
  const compact = size < COMPACT_TILE_THRESHOLD;

  // Stable references so `React.memo` on PlayerToken can actually skip
  // re-rendering tokens whose own player data didn't change.
  const handleAnimationStart = useCallback(
    () => onTokenMovingChange?.(true),
    [onTokenMovingChange]
  );
  const handleAnimationComplete = useCallback(
    () => onTokenMovingChange?.(false),
    [onTokenMovingChange]
  );

  // Slice instead of index-then-map so static analyzers don't flag BOARD[i]
  // as object injection. Corners are at fixed indices 0/10/20/30 and the four
  // edges live between them, walked clockwise from GO.
  const bottomRow = BOARD.slice(1, 10).reverse();
  const leftRow = BOARD.slice(11, 20).reverse();
  const topRow = BOARD.slice(21, 30);
  const rightRow = BOARD.slice(31, 40);
  const [goTile, jailTile, parkingTile, gotojailTile] = [BOARD[0], BOARD[10], BOARD[20], BOARD[30]];
  const corners = { go: goTile, jail: jailTile, parking: parkingTile, gotojail: gotojailTile };

  // O(total properties) instead of scanning every player for every one of the
  // 40 tiles (O(tiles * players * propertiesPerPlayer)) on every render.
  const ownerByTileId = useMemo(() => {
    const map = new Map<string, Player>();
    for (const player of players) {
      for (const propertyId of player.properties) {
        map.set(propertyId, player);
      }
    }
    return map;
  }, [players]);
  const getOwner = (tileId: string) => ownerByTileId.get(tileId);

  return (
    <View style={[styles.boardContainer, { width: size, height: size }]}>
      <View style={styles.center} pointerEvents="box-none">
        {slot}
      </View>

      {players.map((player, index) => (
        <PlayerToken
          key={player.id}
          player={player}
          boardSize={size}
          index={index}
          onAnimationStart={handleAnimationStart}
          onAnimationComplete={handleAnimationComplete}
        />
      ))}

      <View style={[styles.corner, styles.bottomRight]}>
        <Tile tile={corners.go} orientation="corner" onPress={onTilePress} />
      </View>
      <View style={[styles.corner, styles.bottomLeft]}>
        <Tile tile={corners.jail} orientation="corner" onPress={onTilePress} />
      </View>
      <View style={[styles.corner, styles.topLeft]}>
        <Tile tile={corners.parking} orientation="corner" onPress={onTilePress} />
      </View>
      <View style={[styles.corner, styles.topRight]}>
        <Tile tile={corners.gotojail} orientation="corner" onPress={onTilePress} />
      </View>

      <View style={styles.rowBottom}>
        {bottomRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="bottom"
            owner={getOwner(t.id)}
            onPress={onTilePress}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.colLeft}>
        {leftRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="left"
            owner={getOwner(t.id)}
            onPress={onTilePress}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.rowTop}>
        {topRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="top"
            owner={getOwner(t.id)}
            onPress={onTilePress}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.colRight}>
        {rightRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="right"
            owner={getOwner(t.id)}
            onPress={onTilePress}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
};

// Memoized so a GameUI re-render that doesn't change board inputs (toasts,
// modal visibility) skips the whole 40-tile subtree — pays off only because
// GameUI keeps its callbacks/sharedProps referentially stable.
export const Board = React.memo(BoardComponent);

const styles = StyleSheet.create({
  boardContainer: {
    backgroundColor: '#CDE6D0',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#000',
  },
  center: {
    position: 'absolute',
    left: `${CORNER_SIZE_PCT}%`,
    top: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  corner: {
    position: 'absolute',
    width: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    zIndex: 10,
  },
  bottomRight: { bottom: 0, right: 0 },
  bottomLeft: { bottom: 0, left: 0 },
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0 },
  rowBottom: {
    position: 'absolute',
    bottom: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  rowTop: {
    position: 'absolute',
    top: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  colLeft: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    left: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column',
  },
  colRight: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    right: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column',
  },
});
