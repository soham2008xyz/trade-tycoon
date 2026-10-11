import React from 'react';
import { View, Text } from 'react-native';
import { BOARD } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { createTradeStyles } from './trade-styles';

interface TradePropertyLineProps {
  tileId: string;
}

/** One property line in the trade-proposal display (color swatch + tile name). */
export const TradePropertyLine: React.FC<TradePropertyLineProps> = ({ tileId }) => {
  const styles = createTradeStyles(useTheme());
  const tile = BOARD.find((t) => t.id === tileId);
  const groupColor = tile?.group ? GROUP_COLORS[tile.group] : null;
  return (
    <View style={[styles.propItem, styles.nameRow, { justifyContent: 'flex-start' }]}>
      {groupColor && <View style={[styles.propertyColor, { backgroundColor: groupColor }]} />}
      <Text style={styles.text}>• {tile?.name}</Text>
    </View>
  );
};
