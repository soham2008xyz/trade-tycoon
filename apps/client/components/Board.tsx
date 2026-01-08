import React from 'react';
import { View, StyleSheet, Dimensions, useWindowDimensions, Text } from 'react-native';
import { BOARD, Player } from '@trade-tycoon/game-logic';
import { Tile } from './Tile';

const CORNER_SIZE_PCT = 14;

interface Props {
  players: Player[];
}

export const Board: React.FC<Props> = ({ players }) => {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) - 20; // Padding

  // Slice the board into sections
  const bottomRow = [BOARD[9], BOARD[8], BOARD[7], BOARD[6], BOARD[5], BOARD[4], BOARD[3], BOARD[2], BOARD[1]];
  const leftRow = [BOARD[19], BOARD[18], BOARD[17], BOARD[16], BOARD[15], BOARD[14], BOARD[13], BOARD[12], BOARD[11]];
  const topRow = [BOARD[21], BOARD[22], BOARD[23], BOARD[24], BOARD[25], BOARD[26], BOARD[27], BOARD[28], BOARD[29]];
  const rightRow = [BOARD[31], BOARD[32], BOARD[33], BOARD[34], BOARD[35], BOARD[36], BOARD[37], BOARD[38], BOARD[39]];

    const corners = {
      go: BOARD[0],
      jail: BOARD[10],
      parking: BOARD[20],
      gotojail: BOARD[30],
    };

    const getPlayersOnTile = (index: number) => players.filter(p => p.position === index);
    const getOwner = (tileId: string) => players.find(p => p.properties.includes(tileId));

    return (
      <View style={[styles.boardContainer, { width: size, height: size }]}>

        {/* Center Logo Area */}
        <View style={styles.center}>
          {/* We can put dice and logos here later */}
        </View>

        {/* Corners */}
        <View style={[styles.corner, styles.bottomRight]}>
          <Tile tile={corners.go} orientation="corner" players={getPlayersOnTile(0)} />
        </View>
        <View style={[styles.corner, styles.bottomLeft]}>
          <Tile tile={corners.jail} orientation="corner" players={getPlayersOnTile(10)} />
        </View>
        <View style={[styles.corner, styles.topLeft]}>
          <Tile tile={corners.parking} orientation="corner" players={getPlayersOnTile(20)} />
        </View>
        <View style={[styles.corner, styles.topRight]}>
          <Tile tile={corners.gotojail} orientation="corner" players={getPlayersOnTile(30)} />
        </View>

        {/* Rows */}
        <View style={styles.rowBottom}>
          {bottomRow.map(t => <Tile key={t.id} tile={t} orientation="bottom" players={getPlayersOnTile(t.index)} owner={getOwner(t.id)} />)}
        </View>

        <View style={styles.colLeft}>
          {leftRow.map(t => <Tile key={t.id} tile={t} orientation="left" players={getPlayersOnTile(t.index)} owner={getOwner(t.id)} />)}
        </View>

        <View style={styles.rowTop}>
          {topRow.map(t => <Tile key={t.id} tile={t} orientation="top" players={getPlayersOnTile(t.index)} owner={getOwner(t.id)} />)}
        </View>

        <View style={styles.colRight}>
          {rightRow.map(t => <Tile key={t.id} tile={t} orientation="right" players={getPlayersOnTile(t.index)} owner={getOwner(t.id)} />)}
        </View>

      </View>
    );
  };
const styles = StyleSheet.create({
  boardContainer: {
    backgroundColor: '#CDE6D0', // Classic board center color
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

  // Rows and Cols
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
    flexDirection: 'column-reverse', // 11 is at bottom, 19 at top
  },
  colRight: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    right: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column', // 31 at top, 39 at bottom
  },
});
