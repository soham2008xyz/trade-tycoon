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

interface Props {
  visible: boolean;
  player: Player;
  onClose: () => void;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
}

interface PropertyRowProps {
  tile: Tile;
  player: Player;
  hasCompleteGroup: boolean;
  groupHasHouses: boolean;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
}

/**
 * One row in the property manager: name + house count + the appropriate
 * Build/Sell/Mortgage/Unmortgage controls for the property's current state.
 * Kept as its own component so the parent's group-map callback stays small.
 */
const PropertyRow: React.FC<PropertyRowProps> = ({
  tile,
  player,
  hasCompleteGroup,
  groupHasHouses,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
}) => {
  const houses = player.houses[tile.id] || 0;
  const houseCost = tile.houseCost || 0;
  const isMortgaged = player.mortgaged.includes(tile.id);
  const mortgageValue = tile.mortgageValue || 0;
  const unmortgageCost = Math.ceil(mortgageValue * 1.1);
  const isStreet = tile.type === 'street';
  const showHouseControls = isStreet && !isMortgaged;

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
        {showHouseControls && (
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
        )}
        {isMortgaged ? (
          <IconButton
            title={`Unmortgage ($${unmortgageCost})`}
            icon="bank-plus"
            onPress={() => onUnmortgage(tile.id)}
            color="#5cb85c"
            disabled={player.money < unmortgageCost}
            size="small"
          />
        ) : (
          <IconButton
            title={`Mortgage ($${mortgageValue})`}
            icon="bank-minus"
            onPress={() => onMortgage(tile.id)}
            color="#d9534f"
            disabled={houses > 0 || groupHasHouses}
            size="small"
          />
        )}
      </View>
    </View>
  );
};

interface GroupSectionProps {
  group: string;
  tiles: Tile[];
  player: Player;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
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
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
}) => {
  const ownedCount = tiles.length;
  const totalCount = getPropertiesInGroup(group as PropertyGroup).length;
  const hasCompleteGroup = ownsCompleteGroup(player, group as PropertyGroup);
  const displayName = GROUP_DISPLAY_NAMES[group] || group.toUpperCase();
  const groupTiles = getPropertiesInGroup(group as PropertyGroup);
  const groupHasHouses = groupTiles.some((t) => (player.houses[t.id] || 0) > 0);

  return (
    <View style={styles.groupContainer}>
      <View style={[styles.groupHeader, { backgroundColor: GROUP_COLORS[group] || '#ccc' }]}>
        <Text style={styles.groupTitle}>
          {displayName} ({ownedCount}/{totalCount} properties owned)
        </Text>
      </View>
      {tiles.map((tile) => (
        <PropertyRow
          key={tile.id}
          tile={tile}
          player={player}
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
  // Group properties by color
  const properties = player.properties
    .map((id) => BOARD.find((t) => t.id === id))
    .filter(
      (t): t is Tile =>
        !!t && (t.type === 'street' || t.type === 'railroad' || t.type === 'utility')
    )
    .reduce(
      (acc, tile) => {
        const group = tile.group || 'misc';
        if (!acc[group]) acc[group] = [];
        acc[group].push(tile);
        return acc;
      },
      {} as Record<string, Tile[]>
    );

  // Sort groups by board index roughly (just standard order)
  const sortedGroups = Object.keys(properties).sort((a, b) => {
    // Simple check if one tile in group A is < tile in group B
    const idxA = properties[a][0].index;
    const idxB = properties[b][0].index;
    return idxA - idxB;
  });

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
            {sortedGroups.length === 0 ? (
              <Text style={styles.emptyText}>You don&apos;t own any buildable properties.</Text>
            ) : (
              sortedGroups.map((group) => (
                <GroupSection
                  key={group}
                  group={group}
                  tiles={properties[group]}
                  player={player}
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
