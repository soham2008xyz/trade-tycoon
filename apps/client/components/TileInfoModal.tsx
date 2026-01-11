import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Tile, Player, TileType } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';

interface Props {
  visible: boolean;
  tile: Tile | null;
  owner?: Player;
  onClose: () => void;
}

const GROUP_COLORS: Record<string, string> = {
  brown: '#955436',
  light_blue: '#AAE0FA',
  pink: '#D93A96',
  orange: '#F7941D',
  red: '#ED1B24',
  yellow: '#FEF200',
  green: '#1FB25A',
  dark_blue: '#0072BB',
  railroad: '#000000',
  utility: '#A0A0A0',
};

// Descriptions for special tiles
const SPECIAL_TILE_DESCRIPTIONS: Partial<Record<TileType, string>> = {
  go: "Collect $200 when you pass.",
  community_chest: "Draw a Community Chest card.",
  chance: "Draw a Chance card.",
  tax: "Pay the tax amount shown.",
  jail: "If you land here, you are just visiting. If sent here, you are in Jail.",
  parking: "No action.",
  go_to_jail: "Go directly to Jail. Do not pass GO, do not collect $200.",
};

export const TileInfoModal: React.FC<Props> = ({ visible, tile, owner, onClose }) => {
  if (!tile || !visible) return null;

  const isStreet = tile.type === 'street';
  const isRailroad = tile.type === 'railroad';
  const isUtility = tile.type === 'utility';
  const isTax = tile.type === 'tax';
  const color = tile.group ? GROUP_COLORS[tile.group] : '#eee';
  const textColor = ['brown', 'dark_blue', 'railroad'].includes(tile.group || '')
    ? '#fff'
    : '#000';

  const houseCount = owner?.houses[tile.id] || 0;
  const isMortgaged = owner?.mortgaged.includes(tile.id) || false;

  const renderRentDetails = () => {
    if (isStreet && tile.rent) {
      const rents = [
        { label: 'Rent', value: tile.rent[0] },
        { label: 'With 1 House', value: tile.rent[1] },
        { label: 'With 2 Houses', value: tile.rent[2] },
        { label: 'With 3 Houses', value: tile.rent[3] },
        { label: 'With 4 Houses', value: tile.rent[4] },
        { label: 'With Hotel', value: tile.rent[5] },
      ];

      return (
        <View style={styles.rentSection}>
          {rents.map((r, index) => {
            const isCurrent = !isMortgaged && houseCount === index && !!owner;
            // index 5 is hotel (5 houses)

            return (
              <View
                key={index}
                style={[styles.rentRow, isCurrent && styles.activeRentRow]}
              >
                <Text style={styles.rentLabel}>{r.label}</Text>
                <Text style={styles.rentValue}>${r.value}</Text>
              </View>
            );
          })}
          <Text style={styles.note}>
            Rent is doubled on unimproved sites in that group if player owns all sites.
          </Text>
        </View>
      );
    }

    if (isRailroad && tile.rent) {
      const rrLabels = ['1 Railroad', '2 Railroads', '3 Railroads', '4 Railroads'];
      return (
        <View style={styles.rentSection}>
          {tile.rent.map((val, index) => (
             <View key={index} style={styles.rentRow}>
               <Text style={styles.rentLabel}>Rent if own {rrLabels[index]}</Text>
               <Text style={styles.rentValue}>${val}</Text>
             </View>
          ))}
        </View>
      );
    }

    if (isUtility) {
        return (
            <View style={styles.rentSection}>
                <Text style={styles.text}>
                    If one utility is owned, rent is 4x amount shown on dice.
                </Text>
                <Text style={styles.text}>
                    If both utilities are owned, rent is 10x amount shown on dice.
                </Text>
            </View>
        )
    }

    return null;
  };

  const renderDescription = () => {
    const desc = SPECIAL_TILE_DESCRIPTIONS[tile.type];
    if (desc) {
      return (
        <View style={styles.section}>
          <Text style={styles.descriptionText}>{desc}</Text>
        </View>
      );
    }
    return null;
  };

  // We are NOT using Modal here because of Z-Index issues on web with Board.
  // Instead we are using an absolute positioned view which will overlay everything in Board
  // because it is rendered LAST in the Board component.
  return (
    <View style={styles.overlayContainer}>
      <View style={styles.backdrop} onTouchEnd={onClose} />
      <View style={styles.modalContent}>
          {/* Header Card */}
          <View style={[styles.header, { backgroundColor: color }]}>
            <Text style={[styles.title, { color: textColor }]}>{tile.name}</Text>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Price & Status */}
             <View style={styles.section}>
                {tile.price && (
                    <View style={styles.row}>
                        {isTax ? (
                          <Text style={styles.text}>Tax Amount:</Text>
                        ) : (
                          <Text style={styles.text}>Price:</Text>
                        )}
                        <Text style={styles.text}>${tile.price}</Text>
                    </View>
                )}

                {owner ? (
                    <>
                        <Text style={styles.text}>Owned by: {owner.name}</Text>
                        {isMortgaged && <Text style={styles.mortgagedText}>MORTGAGED</Text>}
                        {isStreet && !isMortgaged && (
                        <Text style={styles.text}>
                            Houses: {houseCount === 5 ? 'Hotel' : houseCount}
                        </Text>
                        )}
                    </>
                ) : (
                    // Show "Unowned" only if it's buyable (has price and NOT tax)
                    // Actually, taxes have price but aren't ownable.
                    (tile.price && !isTax) ? (
                        <Text style={[styles.text, {fontStyle: 'italic', marginTop: 5}]}>Unowned</Text>
                    ) : null
                )}
             </View>

             {/* Special Tile Description */}
             {renderDescription()}

            {/* Rent Details */}
            {renderRentDetails()}

            {/* Costs */}
            <View style={styles.section}>
              {tile.houseCost && (
                <View style={styles.row}>
                    <Text style={styles.text}>Cost of Houses/Hotels:</Text>
                    <Text style={styles.text}>${tile.houseCost} each</Text>
                </View>
              )}
              {tile.mortgageValue && (
                <View style={styles.row}>
                    <Text style={styles.text}>Mortgage Value:</Text>
                    <Text style={styles.text}>${tile.mortgageValue}</Text>
                </View>
              )}
            </View>

          </ScrollView>

          <View style={styles.footer}>
            <IconButton title="Close" icon="close" onPress={onClose} size="small" />
          </View>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // Ensure it sits on top of everything in Board
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: 300,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
    // No zIndex needed here relative to parent, but parent is high
    elevation: 5,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
  },
  text: {
    fontSize: 14,
    color: '#333',
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  mortgagedText: {
      color: 'red',
      fontWeight: 'bold',
      marginTop: 2,
  },
  rentSection: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: '#f9f9f9',
      borderRadius: 5,
  },
  rentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  activeRentRow: {
      backgroundColor: '#e6fffa',
      fontWeight: 'bold',
      paddingHorizontal: 5,
      marginHorizontal: -5,
  },
  rentLabel: {
      fontSize: 12,
  },
  rentValue: {
      fontSize: 12,
      fontWeight: 'bold',
  },
  note: {
      fontSize: 10,
      fontStyle: 'italic',
      marginTop: 5,
      color: '#666',
  },
  footer: {
      padding: 10,
      alignItems: 'center',
      borderTopWidth: 1,
      borderColor: '#eee',
  },
});
