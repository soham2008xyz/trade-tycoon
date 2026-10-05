import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Player, Tile } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import type { StatusPanelButtons } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

/** Who is playing, where they stand and the dice, for the tablet board centre. */
export const TurnInfo: React.FC<{
  player: Player;
  tile: Tile | null;
  panel: StatusPanelProps;
}> = ({ player, tile, panel }) => {
  const groupColor = tile?.group ? GROUP_COLORS[tile.group] : undefined;
  return (
    <View style={styles.gameInfo}>
      <View style={styles.currentPlayerInfo}>
        <Text style={styles.statusText}>Current: </Text>
        <View style={[styles.playerColor, { backgroundColor: player.color }]} />
        <Text style={styles.statusText}>{player.name}</Text>
        <GOOJBadge count={player.getOutOfJailCards} />
      </View>
      <View style={styles.currentTileInfo}>
        <Text style={styles.statusText}>Position: </Text>
        {!panel.isTokenMoving && groupColor && (
          <View style={[styles.tileColor, { backgroundColor: groupColor }]} />
        )}
        <Text style={[styles.statusText, styles.positionText]}>
          {panel.isTokenMoving ? '...' : getPlayerPositionLabel(player, tile?.name)}
        </Text>
      </View>
      <JailStatus player={player} showHint />
      {/* Reserved even before the first roll so the dice appearing does not push
          the buttons below down (#268). */}
      <View style={styles.diceSlot}>
        {panel.state.phase === 'action' && (
          <Dice
            value1={panel.state.dice[0]}
            value2={panel.state.dice[1]}
            isRolling={panel.isTokenMoving}
          />
        )}
      </View>
    </View>
  );
};

interface SlotProps {
  player: Player;
  buttons: StatusPanelButtons;
  panel: StatusPanelProps;
}

const WaitingNotice: React.FC<Pick<SlotProps, 'player' | 'panel'>> = ({ player, panel }) => (
  <>
    <Text style={styles.waitingText}>
      Waiting for {player.name} to play…
      {panel.disconnectedPlayerIds.includes(player.id) ? ' (disconnected)' : ''}
    </Text>
    {panel.removablePlayerIds.includes(player.id) && (
      <IconButton
        title={`Remove ${player.name}`}
        icon="account-remove"
        onPress={() => panel.onRemovePlayer(player.id)}
        color="#d9534f"
      />
    )}
  </>
);

const JailAndDebtButtons: React.FC<Pick<SlotProps, 'buttons' | 'panel'>> = ({ buttons, panel }) => (
  <>
    {buttons.payFine.visible && (
      <IconButton
        title="Pay Fine ($50)"
        icon="cash-remove"
        onPress={panel.onPayFine}
        disabled={!buttons.payFine.enabled}
        color="#d9534f"
      />
    )}
    {buttons.useGOOJCard.visible && (
      <IconButton
        title={`Use Card (${buttons.useGOOJCard.count})`}
        icon="card-account-details"
        onPress={panel.onUseGOOJCard}
        color="#5bc0de"
      />
    )}
    {buttons.declareBankruptcy.visible && (
      <IconButton
        title="Declare Bankruptcy"
        icon="alert-circle"
        onPress={panel.onDeclareBankruptcy}
        color="#444"
      />
    )}
  </>
);

const TurnButtons: React.FC<Pick<SlotProps, 'buttons' | 'panel'>> = ({ buttons, panel }) => (
  <>
    {buttons.roll.visible && <IconButton title="Roll Dice" icon="dice-5" onPress={panel.onRoll} />}
    {buttons.rollAgain.visible && (
      <IconButton
        title="Roll Again"
        icon="dice-multiple"
        onPress={panel.onRollAgain}
        color="orange"
      />
    )}
    {buttons.endTurn.visible && (
      <IconButton title="End Turn" icon="check" onPress={panel.onEndTurn} color="#d9534f" />
    )}
  </>
);

/**
 * Fixed slots, so Manage Properties and the turn button keep their y-position
 * from one step to the next (#268): the decision zone holds whatever the player
 * must settle first (buy or auction, jail options, who we wait for), then
 * Manage, then the single roll / roll again / end turn button.
 */
export const TurnActions: React.FC<SlotProps> = ({ player, buttons, panel }) => (
  <View style={styles.actions}>
    <View style={styles.decisionSlot}>
      {buttons.waiting.visible && <WaitingNotice player={player} panel={panel} />}
      <JailAndDebtButtons buttons={buttons} panel={panel} />
      {buttons.buy.visible && (
        <IconButton title={`Buy ($${buttons.buy.price})`} icon="cart" onPress={panel.onBuy} />
      )}
      {buttons.auction.visible && (
        <IconButton title="Auction" icon="gavel" onPress={panel.onDeclineBuy} color="#f0ad4e" />
      )}
    </View>
    <View style={styles.buttonSlot}>
      {buttons.manage.visible && (
        <IconButton
          title="Manage Properties"
          icon="city"
          onPress={panel.onOpenPropertyManager}
          color="#841584"
        />
      )}
    </View>
    <View style={styles.buttonSlot}>
      <TurnButtons buttons={buttons} panel={panel} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2, flexShrink: 0 },
  gameInfo: { marginBottom: 15, alignItems: 'center', gap: 4 },
  currentPlayerInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  currentTileInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 14 },
  // Shrinks so a long tile name wraps in place at large Dynamic Type instead
  // of overflowing the panel (same pattern as Peek).
  positionText: { flexShrink: 1 },
  tileColor: { width: 12, height: 12, marginRight: 6, borderWidth: 1, borderColor: '#333' },
  actions: { gap: 8, width: '100%' },
  // Dice are 40px tall plus padding; reserve that height before they appear.
  diceSlot: { minHeight: 50, justifyContent: 'center' },
  // Two medium buttons (Buy + Auction) and the gap between them.
  decisionSlot: { minHeight: 96, gap: 8 },
  buttonSlot: { minHeight: 44, justifyContent: 'center' },
  waitingText: {
    color: '#aab8c2',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
