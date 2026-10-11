import React from 'react';
import { View, Text } from 'react-native';
import type { Player, TradeOffer, TradeRequest } from '@trade-tycoon/game-logic';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/IconButton';
import { PlayerMarker } from '../PlayerMarker';
import { canAcceptTrade, canCancelTrade, isWaitingOnTrade } from '../multiplayer-gating';
import { TradePropertyLine } from './TradePropertyLine';
import { createTradeStyles } from './trade-styles';

type TradeAction = (tradeId: string) => void;

interface TradeSideColumnProps {
  /** The player the trade is addressed to; both columns are headed by their name. */
  target?: Player;
  /** "Receives:" or "Gives:". */
  heading: string;
  offer: TradeOffer;
}

/**
 * One column of an in-flight trade: the target's name, the money, cards and
 * properties. The heading's `adjustsFontSizeToFit={true}` is spelled out on
 * purpose: bare, straight after another `{…}` attribute, it makes Lizard (the
 * CI complexity analysis) lose where the component ends and report the rest of
 * the file as one function.
 */
const TradeSideColumn: React.FC<TradeSideColumnProps> = ({ target, heading, offer }) => {
  const styles = createTradeStyles(useTheme());
  return (
    <View style={styles.column}>
      <View style={styles.columnHeadingRow}>
        {target && (
          <PlayerMarker
            color={target.color}
            size={20}
            style={[styles.playerColor, styles.columnHeadingDot]}
          />
        )}
        <Text
          style={[styles.subtitle, styles.columnHeadingText]}
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.7}
        >
          {target?.name} {heading}
        </Text>
      </View>
      <Text style={styles.text}>Money: ${offer.money}</Text>
      <Text style={styles.text}>GOOJ Cards: {offer.getOutOfJailCards}</Text>
      <Text style={styles.propHeader}>Properties:</Text>
      {offer.properties.map((id) => (
        <TradePropertyLine key={id} tileId={id} />
      ))}
    </View>
  );
};

interface ActiveTradeActionsProps {
  trade: TradeRequest;
  initiator?: Player;
  target?: Player;
  currentPlayerId: string;
  isMultiplayer: boolean;
  onAccept: TradeAction;
  onReject: TradeAction;
  onCancel: TradeAction;
}

/**
 * Accept/Reject for the target, Cancel for the initiator, or, for an online
 * observer who can do neither, a line saying who we are waiting on. Which
 * of the three shows is decided by `multiplayer-gating`.
 */
const ActiveTradeActions: React.FC<ActiveTradeActionsProps> = ({
  trade,
  initiator,
  target,
  currentPlayerId,
  isMultiplayer,
  onAccept,
  onReject,
  onCancel,
}) => {
  const theme = useTheme();
  const styles = createTradeStyles(theme);
  return (
    <>
      {canAcceptTrade(currentPlayerId, trade, isMultiplayer) && (
        <View style={styles.buttonRow}>
          <IconButton
            title="Accept"
            icon="check"
            onPress={() => {
              onAccept(trade.id);
            }}
            color={theme.successFill}
          />
          <IconButton
            title="Reject"
            icon="close"
            onPress={() => {
              onReject(trade.id);
            }}
            color={theme.danger}
          />
        </View>
      )}
      {canCancelTrade(currentPlayerId, trade, isMultiplayer) && (
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <IconButton
            title={`Cancel (by ${initiator?.name})`}
            icon="close-circle"
            onPress={() => {
              onCancel(trade.id);
            }}
            color={theme.neutralButton}
            size="small"
          />
        </View>
      )}
      {isWaitingOnTrade(currentPlayerId, trade, isMultiplayer) && (
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={styles.headerSubtitle}>Waiting for {target?.name} to respond…</Text>
        </View>
      )}
    </>
  );
};

interface ActiveTradeViewProps {
  trade: TradeRequest;
  players: Player[];
  currentPlayerId: string;
  isMultiplayer: boolean;
  isPhone: boolean;
  onAccept: TradeAction;
  onReject: TradeAction;
  onCancel: TradeAction;
}

/** A trade that has been proposed: who offers what to whom, plus the buttons this client may use. */
export const ActiveTradeView: React.FC<ActiveTradeViewProps> = ({
  trade,
  players,
  currentPlayerId,
  isMultiplayer,
  isPhone,
  onAccept,
  onReject,
  onCancel,
}) => {
  const styles = createTradeStyles(useTheme());
  const initiator = players.find((p) => p.id === trade.initiatorId);
  const target = players.find((p) => p.id === trade.targetPlayerId);

  return (
    <View style={isPhone ? styles.phoneContent : styles.modalContent}>
      {!isPhone && <Text style={styles.title}>Trade Proposal</Text>}
      <View style={[styles.headerSubtitle, styles.nameRow, { flexWrap: 'wrap' }]}>
        {initiator && <PlayerMarker color={initiator.color} size={20} style={styles.playerColor} />}
        <Text style={styles.text}>{initiator?.name}</Text>
        <Text style={styles.text}> offers to </Text>
        {target && <PlayerMarker color={target.color} size={20} style={styles.playerColor} />}
        <Text style={styles.text}>{target?.name}:</Text>
      </View>
      <View style={styles.columns}>
        <TradeSideColumn target={target} heading="Receives:" offer={trade.offer} />
        <TradeSideColumn target={target} heading="Gives:" offer={trade.request} />
      </View>
      <ActiveTradeActions
        trade={trade}
        initiator={initiator}
        target={target}
        currentPlayerId={currentPlayerId}
        isMultiplayer={isMultiplayer}
        onAccept={onAccept}
        onReject={onReject}
        onCancel={onCancel}
      />
    </View>
  );
};
