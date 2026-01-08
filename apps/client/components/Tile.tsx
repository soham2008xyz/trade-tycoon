import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Tile as TileType, Player } from '@trade-tycoon/game-logic';

interface Props {
  tile: TileType;
  orientation: 'bottom' | 'left' | 'top' | 'right' | 'corner';
  style?: StyleProp<ViewStyle>;
  players?: Player[];
}

const GROUP_COLORS: Record<string, string> = {
  brown: '#8B4513',
  light_blue: '#87CEEB',
  pink: '#FF69B4',
  orange: '#FFA500',
  red: '#FF0000',
  yellow: '#FFFF00',
  green: '#008000',
  dark_blue: '#00008B',
  railroad: '#000000',
  utility: '#D3D3D3',
};

export const Tile: React.FC<Props> = ({ tile, orientation, style, players = [] }) => {
  const isStreet = tile.type === 'street';
  const color = tile.group ? GROUP_COLORS[tile.group] : '#eee';

  // Determine flex direction based on orientation
  let flexDirection: 'column' | 'row' | 'column-reverse' | 'row-reverse' = 'column';

  if (orientation === 'bottom') flexDirection = 'column-reverse'; // Color on top
  else if (orientation === 'top') flexDirection = 'column'; // Color on bottom
  else if (orientation === 'left') flexDirection = 'row-reverse'; // Color on right
  else if (orientation === 'right') flexDirection = 'row'; // Color on left

  // Override for corners (simplified)
  if (orientation === 'corner') flexDirection = 'column';

  return (
    <View style={[styles.container, { flexDirection }, style]}>
      {isStreet && (
        <View style={[
          styles.colorBar,
          { backgroundColor: color },
          (orientation === 'left' || orientation === 'right') ? styles.colorBarVertical : styles.colorBarHorizontal
        ]} />
      )}
      <View style={styles.content}>
        <Text style={[styles.text, { fontSize: orientation === 'corner' ? 10 : 8 }]}>
          {tile.name}
        </Text>
        {tile.price && (
          <Text style={styles.price}>${tile.price}</Text>
        )}

        {/* Render Players */}
        <View style={styles.tokenContainer}>
          {players.map(p => (
             <View key={p.id} style={[styles.token, { backgroundColor: p.color }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#FAF8EF',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tokenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
  },
  token: {
    width: 10,
    height: 10,
    borderRadius: 5,
    margin: 1,
    borderWidth: 1,
    borderColor: 'white',
  },
  colorBar: {
    // Dimensions handled below
  },  colorBarHorizontal: {
    width: '100%',
    height: '25%',
  },
  colorBarVertical: {
    width: '25%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  text: {
    textAlign: 'center',
    fontWeight: 'bold',
  },
  price: {
    fontSize: 8,
    marginTop: 2,
  },
});
