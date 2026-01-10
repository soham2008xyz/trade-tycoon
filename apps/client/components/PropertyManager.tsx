import React from 'react';
import { View, Text, StyleSheet, Modal, Button, ScrollView } from 'react-native';
import { Player, BOARD, Tile, ownsCompleteGroup, getPropertiesInGroup, PropertyGroup } from '@trade-tycoon/game-logic';

interface Props {
  visible: boolean;
  player: Player;
  onClose: () => void;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
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

const GROUP_DISPLAY_NAMES: Record<string, string> = {
  brown: 'Brown',
  light_blue: 'Light Blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  dark_blue: 'Dark Blue',
  railroad: 'Railroads',
  utility: 'Utilities',
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
    .filter((t): t is Tile => !!t && (t.type === 'street' || t.type === 'railroad' || t.type === 'utility'))
    .reduce((acc, tile) => {
      const group = tile.group || 'misc';
      if (!acc[group]) acc[group] = [];
      acc[group].push(tile);
      return acc;
    }, {} as Record<string, Tile[]>);

  // Sort groups by board index roughly (just standard order)
  const sortedGroups = Object.keys(properties).sort((a, b) => {
     // Simple check if one tile in group A is < tile in group B
     const idxA = properties[a][0].index;
     const idxB = properties[b][0].index;
     return idxA - idxB;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Manage Properties</Text>
          <Text style={styles.balance}>Cash: ${player.money}</Text>

          <ScrollView style={styles.scroll}>
            {sortedGroups.length === 0 ? (
                <Text style={styles.emptyText}>You don&apos;t own any buildable properties.</Text>
            ) : (
                sortedGroups.map((group) => {
                  const ownedCount = properties[group].length;
                  // For streets, total count is usually accurate via getPropertiesInGroup.
                  // Since we filtered by street, and we are iterating groups from that filtered list,
                  // we are dealing with street groups.
                  const totalCount = getPropertiesInGroup(group as PropertyGroup).length;
                  const hasCompleteGroup = ownsCompleteGroup(player, group as PropertyGroup);
                  const displayName = GROUP_DISPLAY_NAMES[group] || group.toUpperCase();

                  return (
                    <View key={group} style={styles.groupContainer}>
                      <View style={[styles.groupHeader, { backgroundColor: GROUP_COLORS[group] || '#ccc' }]}>
                        <Text style={styles.groupTitle}>
                          {displayName} ({ownedCount}/{totalCount} properties owned)
                        </Text>
                      </View>
                      {properties[group].map((tile) => {
                        const houses = player.houses[tile.id] || 0;
                        const houseCost = tile.houseCost || 0;
                        const isMortgaged = player.mortgaged.includes(tile.id);
                        const mortgageValue = tile.mortgageValue || 0;
                        const unmortgageCost = Math.ceil(mortgageValue * 1.1);

                        // Validation for mortgage logic
                        const groupTiles = getPropertiesInGroup(group as PropertyGroup);
                        const groupHasHouses = groupTiles.some((t) => (player.houses[t.id] || 0) > 0);

                        return (
                          <View key={tile.id} style={styles.propertyRow}>
                            <View style={styles.propertyInfo}>
                              <Text style={[styles.propertyName, isMortgaged && styles.mortgagedText]}>
                                {tile.name} {isMortgaged ? '(Mortgaged)' : ''}
                              </Text>
                              {tile.type === 'street' && (
                                <Text style={styles.houseCount}>
                                  {houses === 5 ? 'Hotel' : `${houses} House${houses !== 1 ? 's' : ''}`}
                                </Text>
                              )}
                            </View>
                            <View style={styles.buttons}>
                              {/* Build/Sell Houses (Only for Streets) */}
                              {tile.type === 'street' && !isMortgaged && (
                                <>
                                  <Button
                                    title={`Build ($${houseCost})`}
                                    onPress={() => onBuild(tile.id)}
                                    disabled={
                                      player.money < houseCost || houses >= 5 || !hasCompleteGroup
                                    }
                                  />
                                  <View style={{ width: 8 }} />
                                  <Button
                                    title={`Sell ($${houseCost / 2})`}
                                    onPress={() => onSell(tile.id)}
                                    color="orange"
                                    disabled={houses <= 0}
                                  />
                                  <View style={{ width: 8 }} />
                                </>
                              )}

                              {/* Mortgage/Unmortgage */}
                              {!isMortgaged ? (
                                <Button
                                  title={`Mortgage ($${mortgageValue})`}
                                  onPress={() => onMortgage(tile.id)}
                                  color="red"
                                  disabled={houses > 0 || groupHasHouses}
                                />
                              ) : (
                                <Button
                                  title={`Unmortgage ($${unmortgageCost})`}
                                  onPress={() => onUnmortgage(tile.id)}
                                  color="green"
                                  disabled={player.money < unmortgageCost}
                                />
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
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
    borderRadius: 10,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
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
    flexDirection: 'row',
  },
  footer: {
    marginTop: 10,
  },
});
