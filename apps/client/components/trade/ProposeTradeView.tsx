import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { Player, TradeOffer } from '@trade-tycoon/game-logic';
import type { TradeDraft } from '../../hooks/useTradeDraft';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/IconButton';
import { CloseButton } from '../ui/CloseButton';
import { PlayerMarker } from '../PlayerMarker';
import { OfferColumn } from './OfferColumn';
import { createTradeStyles } from './trade-styles';

interface ProposeTradeHeaderProps {
  target: Player;
  isPhone: boolean;
  onClose: () => void;
}

/** "Propose Trade to ● Name", with an in-card ✕ on wide layouts only. */
const ProposeTradeHeader: React.FC<ProposeTradeHeaderProps> = ({ target, isPhone, onClose }) => {
  const styles = createTradeStyles(useTheme());
  return (
    <View style={styles.headerRow}>
      <View style={styles.nameRow}>
        <Text style={styles.title}>Propose Trade to</Text>
        <PlayerMarker color={target.color} size={20} style={styles.playerColor} />
        <Text style={styles.title}>{target.name}</Text>
      </View>
      {!isPhone && (
        <View style={styles.closeButtonContainer}>
          <CloseButton onPress={onClose} />
        </View>
      )}
    </View>
  );
};

interface ProposeTradeFooterProps {
  isPhone: boolean;
  onPropose: () => void;
  onClose: () => void;
}

/** Propose, plus Cancel on wide layouts (phone's shell header already closes the modal). */
const ProposeTradeFooter: React.FC<ProposeTradeFooterProps> = ({ isPhone, onPropose, onClose }) => {
  const theme = useTheme();
  const styles = createTradeStyles(theme);
  return (
    <View style={styles.footer}>
      <IconButton title="Propose" icon="handshake" onPress={onPropose} />
      {!isPhone && (
        <>
          <View style={{ width: 10 }} />
          <IconButton title="Cancel" icon="close" onPress={onClose} color={theme.neutralButton} />
        </>
      )}
    </View>
  );
};

interface ProposeTradeViewProps {
  /** The local player, who gives the "You Offer" side. */
  initiator: Player;
  /** The player being proposed to, who gives the "You Request" side. */
  target: Player;
  draft: TradeDraft;
  isPhone: boolean;
  onPropose: (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => void;
  onClose: () => void;
}

/**
 * The proposal form. On phone the shell already draws the title and ✕ and
 * fills the screen, so the in-card ✕ and Cancel button are wide-layout only.
 */
export const ProposeTradeView: React.FC<ProposeTradeViewProps> = ({
  initiator,
  target,
  draft,
  isPhone,
  onPropose,
  onClose,
}) => {
  const styles = createTradeStyles(useTheme());

  return (
    <View style={isPhone ? styles.phoneContent : styles.modalContent}>
      <ProposeTradeHeader target={target} isPhone={isPhone} onClose={onClose} />
      <ScrollView style={isPhone ? styles.phoneScrollArea : styles.scrollArea}>
        <View style={styles.columns}>
          <OfferColumn
            role="offer"
            player={initiator}
            offer={draft.offer}
            onChange={draft.setOffer}
          />
          <View style={styles.divider} />
          <OfferColumn
            role="request"
            player={target}
            offer={draft.request}
            onChange={draft.setRequest}
          />
        </View>
      </ScrollView>
      <ProposeTradeFooter
        isPhone={isPhone}
        onPropose={() => {
          onPropose(target.id, draft.offer, draft.request);
        }}
        onClose={onClose}
      />
    </View>
  );
};
