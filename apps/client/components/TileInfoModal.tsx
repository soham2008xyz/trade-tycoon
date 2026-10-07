import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Tile, Player } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { GROUP_COLORS } from '../constants';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { useGameLayout } from '../hooks/useGameLayout';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';

interface Props {
  visible: boolean;
  tile: Tile | null;
  owner?: Player;
  onClose: () => void;
  /** Toasts to draw above the modal while it is open (see `FullScreenModalShell`). */
  overlay?: React.ReactNode;
}

type Styles = ReturnType<typeof createStyles>;

interface SectionProps {
  tile: Tile;
  owner?: Player;
  styles: Styles;
}

// Light banner text on the dark group colours, dark text on the rest.
const DARK_GROUPS = ['brown', 'dark_blue', 'railroad'];

const STREET_RENT_LABELS = [
  'Rent',
  'With 1 House',
  'With 2 Houses',
  'With 3 Houses',
  'With 4 Houses',
  'With Hotel',
];
const RAILROAD_RENT_LABELS = ['1 Railroad', '2 Railroads', '3 Railroads', '4 Railroads'];

interface StreetRentProps extends SectionProps {
  rent: number[];
}

const StreetRent: React.FC<StreetRentProps> = ({ tile, owner, rent, styles }) => {
  // The owner's current rent tier is highlighted; index 5 is the hotel.
  const currentTier =
    owner && !owner.mortgaged.includes(tile.id) ? owner.houses[tile.id] || 0 : null;
  return (
    <View style={styles.rentSection}>
      {STREET_RENT_LABELS.map((label, index) => (
        <View key={label} style={[styles.rentRow, currentTier === index && styles.activeRentRow]}>
          <Text style={styles.rentLabel}>{label}</Text>
          <Text style={styles.rentValue}>${rent.at(index)}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        Rent is doubled on unimproved sites in that group if player owns all sites.
      </Text>
    </View>
  );
};

interface RailroadRentProps {
  rent: number[];
  styles: Styles;
}

const RailroadRent: React.FC<RailroadRentProps> = ({ rent, styles }) => (
  <View style={styles.rentSection}>
    {rent.map((val, index) => (
      <View key={index} style={styles.rentRow}>
        <Text style={styles.rentLabel}>Rent if own {RAILROAD_RENT_LABELS.at(index)}</Text>
        <Text style={styles.rentValue}>${val}</Text>
      </View>
    ))}
  </View>
);

const RentDetails: React.FC<SectionProps> = ({ tile, owner, styles }) => {
  if (tile.type === 'street' && tile.rent) {
    return <StreetRent tile={tile} owner={owner} rent={tile.rent} styles={styles} />;
  }
  if (tile.type === 'railroad' && tile.rent) {
    return <RailroadRent rent={tile.rent} styles={styles} />;
  }
  if (tile.type === 'utility') {
    return (
      <View style={styles.rentSection}>
        <Text style={styles.text}>If one utility is owned, rent is 4x amount shown on dice.</Text>
        <Text style={styles.text}>
          If both utilities are owned, rent is 10x amount shown on dice.
        </Text>
      </View>
    );
  }
  return null;
};

interface OwnerStatusProps extends SectionProps {
  owner: Player;
}

const OwnerStatus: React.FC<OwnerStatusProps> = ({ tile, owner, styles }) => {
  const isMortgaged = owner.mortgaged.includes(tile.id);
  const houseCount = owner.houses[tile.id] || 0;
  return (
    <>
      <Text style={styles.text}>Owned by: {owner.name}</Text>
      {isMortgaged && <Text style={styles.mortgagedText}>MORTGAGED</Text>}
      {tile.type === 'street' && !isMortgaged && (
        <Text style={styles.text}>Houses: {houseCount === 5 ? 'Hotel' : houseCount}</Text>
      )}
    </>
  );
};

// Price & status.
const PriceSection: React.FC<SectionProps> = ({ tile, owner, styles }) => {
  const isTax = tile.type === 'tax';
  return (
    <View style={styles.section}>
      {tile.price && (
        <View style={styles.row}>
          <Text style={styles.text}>{isTax ? 'Tax Amount:' : 'Price:'}</Text>
          <Text style={styles.text}>${tile.price}</Text>
        </View>
      )}
      {owner ? (
        <OwnerStatus tile={tile} owner={owner} styles={styles} />
      ) : // "Unowned" only for buyable tiles: taxes have a price but can't be owned.
      tile.price && !isTax ? (
        <Text style={[styles.text, { fontStyle: 'italic', marginTop: 5 }]}>Unowned</Text>
      ) : null}
    </View>
  );
};

interface CostsSectionProps {
  tile: Tile;
  styles: Styles;
}

const CostsSection: React.FC<CostsSectionProps> = ({ tile, styles }) => (
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
);

const TileBody: React.FC<SectionProps> = ({ tile, owner, styles }) => (
  <ScrollView style={styles.scrollContent}>
    <PriceSection tile={tile} owner={owner} styles={styles} />
    {/* Special tile description */}
    {tile.description ? (
      <View style={styles.section}>
        <Text style={styles.descriptionText}>{tile.description}</Text>
      </View>
    ) : null}
    <RentDetails tile={tile} owner={owner} styles={styles} />
    <CostsSection tile={tile} styles={styles} />
  </ScrollView>
);

export const TileInfoModal: React.FC<Props> = ({ visible, tile, owner, onClose, overlay }) => {
  // Hook must run before the early return below to keep hook order stable.
  const isPhone = useGameLayout() === 'phone';
  const styles = createStyles(useTheme());

  // Skip rendering entirely when closed — the FullScreenModalShell would hide
  // its Modal anyway, but the children tree (backdrop + ScrollView + rent
  // table) would still reconcile on every parent re-render. Cheap early-exit.
  if (!tile || !visible) return null;

  const color = tile.group ? GROUP_COLORS[tile.group] : '#eee';
  const textColor = DARK_GROUPS.includes(tile.group || '') ? '#fff' : '#000';

  return (
    <FullScreenModalShell visible={visible} onClose={onClose} title={tile.name} overlay={overlay}>
      <View style={isPhone ? styles.phoneContainer : styles.overlayContainer}>
        {!isPhone && <View style={styles.backdrop} onTouchEnd={onClose} />}
        <View style={isPhone ? styles.phoneContent : styles.modalContent}>
          {/* On phone the shell header already shows the tile name and ✕, so
              the colour banner is just the group-colour strip. */}
          {isPhone ? (
            <View style={[styles.colorStrip, { backgroundColor: color }]} />
          ) : (
            <View style={[styles.header, { backgroundColor: color }]}>
              <Text style={[styles.title, { color: textColor }]}>{tile.name}</Text>
            </View>
          )}

          <TileBody tile={tile} owner={owner} styles={styles} />

          {!isPhone && (
            <View style={styles.footer}>
              <IconButton title="Close" icon="close" onPress={onClose} size="small" />
            </View>
          )}
        </View>
      </View>
    </FullScreenModalShell>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    phoneContainer: { flex: 1, backgroundColor: theme.surface },
    phoneContent: { flex: 1 },
    colorStrip: { height: 16, borderBottomWidth: 2, borderBottomColor: theme.outline },
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
      backgroundColor: theme.scrim,
    },
    modalContent: {
      width: 300,
      maxHeight: '80%',
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.outline,
      overflow: 'hidden',
      // No zIndex needed here relative to parent, but parent is high
      elevation: 5,
    },
    header: {
      padding: 20,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: theme.outline,
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
      borderBottomColor: theme.border,
      paddingBottom: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    text: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    descriptionText: {
      fontSize: 14,
      color: theme.textPrimary,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    mortgagedText: {
      color: theme.errorText,
      fontWeight: 'bold',
      marginTop: 2,
    },
    rentSection: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 5,
    },
    rentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    activeRentRow: {
      backgroundColor: theme.surfaceInfo,
      fontWeight: 'bold',
      paddingHorizontal: 5,
      marginHorizontal: -5,
    },
    rentLabel: {
      fontSize: 12,
      color: theme.textPrimary,
    },
    rentValue: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.textPrimary,
    },
    note: {
      fontSize: 10,
      fontStyle: 'italic',
      marginTop: 5,
      color: theme.textSecondary,
    },
    footer: {
      padding: 10,
      alignItems: 'center',
      borderTopWidth: 1,
      borderColor: theme.border,
    },
  });
