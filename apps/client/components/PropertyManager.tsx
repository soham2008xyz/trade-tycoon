import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Player,
  BOARD,
  Tile,
  ownsCompleteGroup,
  getPropertiesInGroup,
  PropertyGroup,
} from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { CloseButton } from './ui/CloseButton';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { GROUP_COLORS, GROUP_DISPLAY_NAMES } from '../constants';

// Both `GROUP_COLORS` and `GROUP_DISPLAY_NAMES` are imported as `Record<string, string>`.
// Wrapping them in `Map`s once at module load lets us read with `.get()` instead of
// `OBJ[key]` — the latter trips `eslint-plugin-security`'s detect-object-injection
// rule even though the keys here come from a finite set of `PropertyGroup` values.
const groupColorMap = new Map(Object.entries(GROUP_COLORS));
const groupDisplayNameMap = new Map(Object.entries(GROUP_DISPLAY_NAMES));

interface Props {
  visible: boolean;
  player: Player;
  onClose: () => void;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
}

/** Build/Sell pair shown for unmortgaged streets only. */
const HouseControls: React.FC<{
  tile: Tile;
  player: Player;
  houses: number;
  hasCompleteGroup: boolean;
  onBuild: (_propertyId: string) => void;
  onSell: (_propertyId: string) => void;
}> = ({ tile, player, houses, hasCompleteGroup, onBuild, onSell }) => {
  const houseCost = tile.houseCost || 0;
  return (
    <>
      <IconButton
        title={`Build House ($${houseCost})`}
        icon="home-plus"
        onPress={() => onBuild(tile.id)}
        disabled={player.money < houseCost || houses >= 5 || !hasCompleteGroup}
        size="small"
      />
      <IconButton
        title={`Sell House ($${houseCost / 2})`}
        icon="home-minus"
        onPress={() => onSell(tile.id)}
        color="orange"
        disabled={houses <= 0}
        size="small"
      />
    </>
  );
};

/** Mortgage/Unmortgage button — exactly one renders depending on state. */
const MortgageControls: React.FC<{
  tile: Tile;
  player: Player;
  houses: number;
  isMortgaged: boolean;
  groupHasHouses: boolean;
  onMortgage: (_propertyId: string) => void;
  onUnmortgage: (_propertyId: string) => void;
}> = ({ tile, player, houses, isMortgaged, groupHasHouses, onMortgage, onUnmortgage }) => {
  const mortgageValue = tile.mortgageValue || 0;
  const unmortgageCost = Math.ceil(mortgageValue * 1.1);
  if (isMortgaged) {
    return (
      <IconButton
        title={`Unmortgage ($${unmortgageCost})`}
        icon="bank-plus"
        onPress={() => onUnmortgage(tile.id)}
        color="#5cb85c"
        disabled={player.money < unmortgageCost}
        size="small"
      />
    );
  }
  return (
    <IconButton
      title={`Mortgage ($${mortgageValue})`}
      icon="bank-minus"
      onPress={() => onMortgage(tile.id)}
      color="#d9534f"
      disabled={houses > 0 || groupHasHouses}
      size="small"
    />
  );
};

interface PropertyRowProps {
  tile: Tile;
  player: Player;
  houses: number;
  hasCompleteGroup: boolean;
  groupHasHouses: boolean;
  onBuild: (_propertyId: string) => void;
  onSell: (_propertyId: string) => void;
  onMortgage: (_propertyId: string) => void;
  onUnmortgage: (_propertyId: string) => void;
}

/**
 * One row in the property manager: name + house count + the appropriate
 * Build/Sell/Mortgage/Unmortgage controls for the property's current state.
 * `houses` is passed in (rather than read from `player.houses[tile.id]`)
 * so the call site can use a Map lookup that static analyzers don't flag
 * as object-injection.
 */
const PropertyRow: React.FC<PropertyRowProps> = ({
  tile,
  player,
  houses,
  hasCompleteGroup,
  groupHasHouses,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
}) => {
  const isMortgaged = player.mortgaged.includes(tile.id);
  const isStreet = tile.type === 'street';

  return (
    <View style={styles.propertyRow}>
      <View style={styles.propertyInfo}>
        <Text style={[styles.propertyName, isMortgaged && styles.mortgagedText]}>
          {tile.name} {isMortgaged ? '(Mortgaged)' : ''}
        </Text>
        {isStreet && (
          <Text style={styles.houseCount}>
            {houses === 5 ? 'Hotel' : `${houses} House${houses !== 1 ? 's' : ''}`}
          </Text>
        )}
      </View>
      <View style={styles.buttons}>
        {isStreet && !isMortgaged && (
          <HouseControls
            tile={tile}
            player={player}
            houses={houses}
            hasCompleteGroup={hasCompleteGroup}
            onBuild={onBuild}
            onSell={onSell}
          />
        )}
        <MortgageControls
          tile={tile}
          player={player}
          houses={houses}
          isMortgaged={isMortgaged}
          groupHasHouses={groupHasHouses}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
        />
      </View>
    </View>
  );
};

interface GroupSectionProps {
  group: string;
  tiles: Tile[];
  player: Player;
  /** Map of property-id → house count. Derived once at the parent so each
   *  row gets a Map.get() lookup instead of `player.houses[tile.id]` (which
   *  static analyzers can't prove is safe). */
  housesByTile: Map<string, number>;
  onBuild: (_propertyId: string) => void;
  onSell: (_propertyId: string) => void;
  onMortgage: (_propertyId: string) => void;
  onUnmortgage: (_propertyId: string) => void;
}

/**
 * Renders one color-group header plus its property rows. Computes the
 * once-per-group derived flags (complete-group ownership, any-houses-in-group)
 * and passes them down to each row.
 */
const GroupSection: React.FC<GroupSectionProps> = ({
  group,
  tiles,
  player,
  housesByTile,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
}) => {
  const ownedCount = tiles.length;
  // `group` may fall back to 'misc' for unrecognized groups; coerce to an
  // empty array if the helper has nothing for it. Resolved once and reused
  // for both the total count and the any-houses-in-group check.
  const groupTiles = getPropertiesInGroup(group as PropertyGroup) ?? [];
  const totalCount = groupTiles.length;
  const hasCompleteGroup = ownsCompleteGroup(player, group as PropertyGroup);
  const displayName = groupDisplayNameMap.get(group) ?? group.toUpperCase();
  const groupHasHouses = groupTiles.some((t) => (housesByTile.get(t.id) ?? 0) > 0);

  return (
    <View style={styles.groupContainer}>
      <View style={[styles.groupHeader, { backgroundColor: groupColorMap.get(group) ?? '#ccc' }]}>
        <Text style={styles.groupTitle}>
          {displayName} ({ownedCount}/{totalCount} properties owned)
        </Text>
      </View>
      {tiles.map((tile) => (
        <PropertyRow
          key={tile.id}
          tile={tile}
          player={player}
          houses={housesByTile.get(tile.id) ?? 0}
          hasCompleteGroup={hasCompleteGroup}
          groupHasHouses={groupHasHouses}
          onBuild={onBuild}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
        />
      ))}
    </View>
  );
};

export const PropertyManager: React.FC<Props> = ({
  visible,
  player,
  onClose,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
}) => {
  // Group properties by color. Returned as a Map (not a Record<string, Tile[]>)
  // so iteration uses .entries() and static analyzers don't flag the key
  // access as object-injection.
  const propertiesByGroup = player.properties
    .map((id) => BOARD.find((t) => t.id === id))
    .filter(
      (t): t is Tile =>
        !!t && (t.type === 'street' || t.type === 'railroad' || t.type === 'utility')
    )
    .reduce((acc, tile) => {
      const group = tile.group || 'misc';
      const existing = acc.get(group) ?? [];
      existing.push(tile);
      acc.set(group, existing);
      return acc;
    }, new Map<string, Tile[]>());

  // Sort by the first tile's board index so groups appear in standard order.
  const sortedEntries = Array.from(propertiesByGroup.entries()).sort(
    ([, a], [, b]) => a[0].index - b[0].index
  );

  // One Map<tileId, houseCount> for the whole render — passed down so each row
  // does a typed Map.get() rather than `player.houses[tile.id]`.
  const housesByTile = new Map(Object.entries(player.houses));

  return (
    <FullScreenModalShell visible={visible} onClose={onClose} title="Manage Properties">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Manage Properties</Text>
            <View style={styles.closeBtnContainer}>
              <CloseButton onPress={onClose} />
            </View>
          </View>
          <Text style={styles.balance}>Cash: ${player.money}</Text>

          <ScrollView style={styles.scroll}>
            {sortedEntries.length === 0 ? (
              <Text style={styles.emptyText}>You don&apos;t own any buildable properties.</Text>
            ) : (
              sortedEntries.map(([group, tiles]) => (
                <GroupSection
                  key={group}
                  group={group}
                  tiles={tiles}
                  player={player}
                  housesByTile={housesByTile}
                  onBuild={onBuild}
                  onSell={onSell}
                  onMortgage={onMortgage}
                  onUnmortgage={onUnmortgage}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </FullScreenModalShell>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 20,
    elevation: 5,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    position: 'relative',
    minHeight: 40,
  },
  closeBtnContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  balance: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    color: 'green',
    fontWeight: 'bold',
  },
  scroll: {
    marginBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
    marginTop: 20,
  },
  groupContainer: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
  },
  groupHeader: {
    padding: 5,
  },
  groupTitle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      web: {
        textShadow: '0px 0px 2px rgba(0,0,0,0.5)',
      },
      default: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 2,
      },
    }),
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  propertyInfo: {
    flex: 1,
    marginRight: 10,
  },
  propertyName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  mortgagedText: {
    color: 'red',
    fontStyle: 'italic',
  },
  houseCount: {
    fontSize: 12,
    color: '#666',
  },
  buttons: {
    flexDirection: 'column',
    gap: 5,
    minWidth: 140,
  },
});
