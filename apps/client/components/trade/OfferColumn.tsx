import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Player, TradeOffer } from '@trade-tycoon/game-logic';
import { useTheme } from '../../hooks/useTheme';
import { formatMoney } from '../format-money';
import { PlayerMarker } from '../PlayerMarker';
import { moneyFromSlider, moneySliderMax, sliderFromMoney } from '../trade-money';
import { stepCards, toggleProperty, withMoney } from '../trade-draft';
import { tradeColumnCopy } from '../trade-labels';
import type { TradeColumnRole } from '../trade-labels';
import { GoojStepper } from './GoojStepper';
import { PropertyCheckRow } from './PropertyCheckRow';
import { createTradeStyles } from './trade-styles';

interface OfferColumnProps {
  /** `offer`: what the initiator gives (their own holdings). `request`: what they ask for. */
  role: TradeColumnRole;
  /** The player whose cash, cards and properties this column draws from. */
  player: Player;
  offer: TradeOffer;
  onChange: (next: TradeOffer) => void;
}

/**
 * One side of the proposal form: a money slider, a Get Out of Jail Free card
 * stepper (only when the player holds any) and a checkbox per property. The
 * slider is green for what you give and red for what you ask for.
 */
export const OfferColumn: React.FC<OfferColumnProps> = ({ role, player, offer, onChange }) => {
  const theme = useTheme();
  const styles = createTradeStyles(theme);
  const tint = role === 'offer' ? theme.success : theme.danger;
  return (
    <View style={styles.column}>
      <View style={styles.nameRow}>
        <PlayerMarker color={player.color} size={20} style={styles.playerColor} />
        <Text style={styles.subtitle}>{tradeColumnCopy(role).heading}</Text>
      </View>

      <Text style={styles.text}>Money (Max: {formatMoney(player.money)})</Text>
      <View style={styles.sliderRow}>
        <Text style={styles.moneyText}>${offer.money}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={moneySliderMax(player.money)}
          step={1}
          value={sliderFromMoney(offer.money, player.money)}
          onValueChange={(position) => {
            onChange(withMoney(offer, moneyFromSlider(position, player.money)));
          }}
          minimumTrackTintColor={tint}
          maximumTrackTintColor={theme.borderStrong}
          thumbTintColor={tint}
        />
      </View>

      {player.getOutOfJailCards > 0 && (
        <GoojStepper
          role={role}
          selected={offer.getOutOfJailCards}
          owned={player.getOutOfJailCards}
          onStep={(delta) => {
            onChange(stepCards(offer, delta, player.getOutOfJailCards));
          }}
        />
      )}

      <Text style={styles.propHeader}>Properties:</Text>
      {player.properties.length === 0 && <Text style={styles.emptyText}>None</Text>}
      {player.properties.map((id) => (
        <PropertyCheckRow
          key={id}
          propertyId={id}
          checked={offer.properties.includes(id)}
          onToggle={(propertyId) => {
            onChange(toggleProperty(offer, propertyId));
          }}
        />
      ))}
    </View>
  );
};
