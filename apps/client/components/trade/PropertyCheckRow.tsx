import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BOARD } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { createTradeStyles } from './trade-styles';

/**
 * Accessibility props for a property row that toggles in or out of the offer.
 * Native gets a real checkbox. On web react-native-web only fires Space on
 * `role="button"` (it does not turn `role="checkbox"` into an `<input>`), so
 * the row stays a button there and reports its state with `aria-pressed`.
 */
const checkRowA11yProps = (isChecked: boolean, label: string) =>
  Platform.OS === 'web'
    ? { accessibilityRole: 'button' as const, 'aria-pressed': isChecked, accessibilityLabel: label }
    : {
        accessibilityRole: 'checkbox' as const,
        'aria-checked': isChecked,
        accessibilityLabel: label,
      };

interface PropertyCheckRowProps {
  propertyId: string;
  checked: boolean;
  onToggle: (id: string) => void;
}

/** A tappable row: checkbox, color swatch and name for one property in a trade column. */
export const PropertyCheckRow: React.FC<PropertyCheckRowProps> = ({
  propertyId,
  checked,
  onToggle,
}) => {
  const theme = useTheme();
  const styles = createTradeStyles(theme);
  const tile = BOARD.find((t) => t.id === propertyId);
  return (
    <TouchableOpacity
      onPress={() => {
        onToggle(propertyId);
      }}
      style={styles.checkRow}
      {...checkRowA11yProps(checked, tile?.name ?? propertyId)}
    >
      <MaterialCommunityIcons
        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={24}
        color={checked ? theme.success : theme.textSecondary}
      />
      {tile?.group && GROUP_COLORS[tile.group] && (
        <View style={[styles.propertyColor, { backgroundColor: GROUP_COLORS[tile.group] }]} />
      )}
      <Text style={styles.propText}>{tile?.name}</Text>
    </TouchableOpacity>
  );
};
