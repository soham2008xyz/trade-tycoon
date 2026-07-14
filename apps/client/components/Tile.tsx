import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { Tile as TileType, Player } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../constants';

interface Props {
  tile: TileType;
  orientation: 'bottom' | 'left' | 'top' | 'right' | 'corner';
  style?: StyleProp<ViewStyle>;
  owner?: Player;
  /**
   * Takes the tile id rather than being pre-bound to it, so callers (Board)
   * can pass a single stable function reference instead of a fresh closure
   * per tile per render — that's what lets `React.memo` below actually skip
   * re-rendering tiles whose own props didn't change.
   */
  onPress?: (_tileId: string) => void;
  testID?: string;
  /**
   * When true, edge tiles render without the name text. Used on narrow
   * boards (phone, narrow web window) where 33pt-wide tiles can't fit a
   * readable label. Corners are unaffected.
   */
  compact?: boolean;
}

const STRIPES = Array.from({ length: 40 });

// Color bar runs along whichever edge faces the board's center; corners
// simplify to a single fixed layout. Extracted as a lookup (rather than an
// if/else chain inside the component) to keep TileComponent's own
// complexity down — it's a pure mapping with no game-state dependency.
const FLEX_DIRECTION_BY_ORIENTATION: Record<
  Props['orientation'],
  'column' | 'row' | 'column-reverse' | 'row-reverse'
> = {
  bottom: 'column-reverse', // Color on top
  top: 'column', // Color on bottom
  left: 'row-reverse', // Color on right
  right: 'row', // Color on left
  corner: 'column',
};

const renderHouses = (houseCount: number) => {
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

const TileComponent: React.FC<Props> = ({
  tile,
  orientation,
  style,
  owner,
  onPress,
  testID,
  compact = false,
}) => {
  const isStreet = tile.type === 'street';
  const color = tile.group ? GROUP_COLORS[tile.group] : '#eee';
  const houseCount = owner?.houses[tile.id] || 0;
  const isMortgaged = owner?.mortgaged.includes(tile.id);
  const flexDirection = FLEX_DIRECTION_BY_ORIENTATION[orientation];

  return (
    <Pressable
      testID={testID || `tile-${tile.id}`}
      onPress={() => onPress?.(tile.id)}
      style={({ pressed }) => [
        styles.container,
        { flexDirection, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
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
          <View style={styles.houseOverlay}>{renderHouses(houseCount)}</View>
        </View>
      )}
      <View style={styles.content}>
        {owner && <View style={[styles.ownerIndicator, { backgroundColor: owner.color }]} />}
        {!(compact && orientation !== 'corner') && (
          <Text style={[styles.text, { fontSize: orientation === 'corner' ? 10 : 8 }]}>
            {tile.name}
          </Text>
        )}
        {tile.price && <Text style={styles.price}>${tile.price}</Text>}
      </View>
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
    </Pressable>
  );
};

export const Tile = React.memo(TileComponent);

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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(200, 200, 200, 0.5)',
    zIndex: 10,
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
