import React from 'react';
import { View, Text } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { useTheme } from '../../hooks/useTheme';
import { cardStepLabel, goojCardsLabel } from '../trade-labels';
import type { TradeColumnRole } from '../trade-labels';
import { createTradeStyles } from './trade-styles';

interface GoojStepperProps {
  role: TradeColumnRole;
  /** Cards currently on this side of the trade. */
  selected: number;
  /** Cards the player holds, the most they can put on the table. */
  owned: number;
  /** Called with -1 or +1; the caller clamps the result. */
  onStep: (delta: number) => void;
}

/** "GOOJ Cards (1/2)" with a minus and a plus button. */
export const GoojStepper: React.FC<GoojStepperProps> = ({ role, selected, owned, onStep }) => {
  const theme = useTheme();
  const styles = createTradeStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{goojCardsLabel(selected, owned)}</Text>
      <View style={styles.stepper}>
        <IconButton
          title=""
          accessibilityLabel={cardStepLabel(role, 'fewer')}
          icon="minus"
          onPress={() => {
            onStep(-1);
          }}
          size="small"
          style={styles.stepperBtn}
          color={theme.border}
          textColor={theme.textPrimary}
        />
        <IconButton
          title=""
          accessibilityLabel={cardStepLabel(role, 'more')}
          icon="plus"
          onPress={() => {
            onStep(1);
          }}
          size="small"
          style={styles.stepperBtn}
          color={theme.border}
          textColor={theme.textPrimary}
        />
      </View>
    </View>
  );
};
