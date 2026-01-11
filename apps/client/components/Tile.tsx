import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { Tile as TileType, Player } from '@trade-tycoon/game-logic';

interface Props {
  tile: TileType;
  orientation: 'bottom' | 'left' | 'top' | 'right' | 'corner';
  style?: StyleProp<ViewStyle>;
  players?: Player[];
  owner?: Player;
  onPress?: () => void;
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

const STRIPES = Array.from({ length: 40 });

export const Tile: React.FC<Props> = ({ tile, orientation, style, players = [], owner, onPress }) => {
  const isStreet = tile.type === 'street';
  const color = tile.group ? GROUP_COLORS[tile.group] : '#eee';
  const houseCount = owner?.houses[tile.id] || 0;
  const isMortgaged = owner?.mortgaged.includes(tile.id);

  // Determine flex direction based on orientation
  let flexDirection: 'column' | 'row' | 'column-reverse' | 'row-reverse' = 'column';

  if (orientation === 'bottom')
    flexDirection = 'column-reverse'; // Color on top
  else if (orientation === 'top')
    flexDirection = 'column'; // Color on bottom
  else if (orientation === 'left')
    flexDirection = 'row-reverse'; // Color on right
  else if (orientation === 'right') flexDirection = 'row'; // Color on left

  // Override for corners (simplified)
  if (orientation === 'corner') flexDirection = 'column';

  const renderHouses = () => {
    if (houseCount === 0) return null;
    if (houseCount === 5) {
      return <View style={styles.hotel} />;
    }
    return (
      <View style={styles.houseContainer}>
        {Array.from({ length: houseCount }).map((_, i) => (
          <View key={i} style={styles.house} />
        ))}
      </View>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { flexDirection, opacity: pressed ? 0.8 : 1 },
        style
      ]}
    >
      {isMortgaged && (
        <View style={styles.mortgagedOverlay}>
          {STRIPES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stripe,
                {
                  left: i * 10 - 100,
                },
              ]}
            />
          ))}
        </View>
      )}
      {isStreet && (
        <View
          style={[
            styles.colorBar,
            { backgroundColor: color },
            orientation === 'left' || orientation === 'right'
              ? styles.colorBarVertical
              : styles.colorBarHorizontal,
          ]}
        >
          {/* Render Houses on Color Bar */}
          <View style={styles.houseOverlay}>{renderHouses()}</View>
        </View>
      )}
      <View style={styles.content}>
        {owner && <View style={[styles.ownerIndicator, { backgroundColor: owner.color }]} />}
        <Text style={[styles.text, { fontSize: orientation === 'corner' ? 10 : 8 }]}>
          {tile.name}
        </Text>
        {tile.price && <Text style={styles.price}>${tile.price}</Text>}

        {/* Render Players */}
        <View style={styles.tokenContainer}>
          {players.map((p) => (
            <View key={p.id} style={[styles.token, { backgroundColor: p.color }]} />
          ))}
        </View>
      </View>
    </Pressable>
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
  ownerIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  tokenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
  },
  token: {
    width: 14,
    height: 14,
    borderRadius: 7,
    margin: 1,
    borderWidth: 1,
    borderColor: 'white',
  },
  colorBar: {
    position: 'relative',
    // Dimensions handled below
  },
  colorBarHorizontal: {
    width: '100%',
    height: '25%',
  },
  colorBarVertical: {
    width: '25%',
    height: '100%',
  },
  houseOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  houseContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  house: {
    width: 6,
    height: 6,
    backgroundColor: '#0f0', // Green
    borderWidth: 1,
    borderColor: '#000',
  },
  hotel: {
    width: 12,
    height: 8,
    backgroundColor: '#f00', // Red
    borderWidth: 1,
    borderColor: '#000',
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
  mortgagedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200, 200, 200, 0.5)',
    zIndex: 0,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    top: -100,
    bottom: -100,
    width: 4,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    transform: [{ rotate: '45deg' }],
  },
});
