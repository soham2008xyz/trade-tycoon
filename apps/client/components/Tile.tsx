import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tile as TileType, Player } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../constants';
import { getTileAccessibilityLabel } from './tile-labels';
import { getCompactTileGlyph } from './tile-glyphs';

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
   * readable label. Non-street tiles draw a type icon in its place (#318),
   * since they have no colour bar to identify them. Corners are unaffected.
   */
  compact?: boolean;
}

const STRIPES = Array.from({ length: 40 });

// Fixed, like the cream tile background: board colours don't theme.
const GLYPH_COLOR = '#333';
// 10, not larger: on the smallest (320px) board a top/bottom tile's content
// box is ~23x42, and a 12px glyph reached into the owner dot's corner.
const GLYPH_SIZE = 10;

// Tiles have fixed pixel dimensions set by the board layout, so OS text-size
// scaling would break labels mid-word or clip prices. 1 disables scaling.
const TILE_MAX_FONT_SCALE = 1;

// Color bar runs along whichever edge faces the board's center; corners
// simplify to a single fixed layout. Extracted as a lookup (rather than an
// if/else chain inside the component) to keep TileComponent's own
// complexity down — it's a pure mapping with no game-state dependency. A
// `Map` rather than a plain object so the lookup below isn't a bracket
// access on an object (generic-object-injection).
const FLEX_DIRECTION_BY_ORIENTATION = new Map<
  Props['orientation'],
  'column' | 'row' | 'column-reverse' | 'row-reverse'
>([
  // The colour bar always faces the board centre.
  ['bottom', 'column'], // Color on top
  ['top', 'column-reverse'], // Color on bottom
  ['left', 'row-reverse'], // Color on right
  ['right', 'row'], // Color on left
  ['corner', 'column'],
]);

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

const renderColorBar = (
  isStreet: boolean,
  color: string,
  orientation: Props['orientation'],
  houseCount: number
) => {
  if (!isStreet) return null;
  return (
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
  );
};

const renderMortgageOverlay = (isMortgaged: boolean | undefined) => {
  if (!isMortgaged) return null;
  return (
    <View style={styles.mortgagedOverlay}>
      {STRIPES.map((_, i) => (
        <View key={i} style={[styles.stripe, { left: i * 10 - 100 }]} />
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
  const flexDirection = FLEX_DIRECTION_BY_ORIENTATION.get(orientation) ?? 'column';
  const hideName = compact && orientation !== 'corner';
  const glyph = hideName ? getCompactTileGlyph(tile) : null;

  return (
    <Pressable
      testID={testID || `tile-${tile.id}`}
      onPress={() => onPress?.(tile.id)}
      accessibilityRole="button"
      accessibilityLabel={getTileAccessibilityLabel({
        tile,
        ownerName: owner?.name,
        houseCount,
        isMortgaged,
      })}
      accessibilityHint="Shows tile details"
      style={({ pressed }) => [
        styles.container,
        { flexDirection, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {renderColorBar(isStreet, color, orientation, houseCount)}
      <View style={styles.content}>
        {owner && <View style={[styles.ownerIndicator, { backgroundColor: owner.color }]} />}
        {glyph && (
          // The icon is a font glyph, so cap its scaling like the tile text.
          // The Pressable's accessibilityLabel already names the tile.
          <MaterialCommunityIcons
            name={glyph}
            size={GLYPH_SIZE}
            color={GLYPH_COLOR}
            maxFontSizeMultiplier={TILE_MAX_FONT_SCALE}
            accessible={false}
          />
        )}
        {!hideName && (
          <Text
            maxFontSizeMultiplier={TILE_MAX_FONT_SCALE}
            style={[styles.text, { fontSize: orientation === 'corner' ? 10 : 8 }]}
          >
            {tile.name}
          </Text>
        )}
        {tile.price && (
          <Text maxFontSizeMultiplier={TILE_MAX_FONT_SCALE} style={styles.price}>
            ${tile.price}
          </Text>
        )}
      </View>
      {renderMortgageOverlay(isMortgaged)}
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
    // Ownership must stay visible if a compact glyph ever reaches this corner;
    // the mortgage overlay (zIndex 10) still covers both.
    zIndex: 1,
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
