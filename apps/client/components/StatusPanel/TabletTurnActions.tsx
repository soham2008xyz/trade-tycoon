import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Player } from '@trade-tycoon/game-logic';
import { IconButton } from '../ui/IconButton';
import type { StatusPanelButtons } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface SlotProps {
  player: Player;
  buttons: StatusPanelButtons;
  panel: StatusPanelProps;
}

function WaitingNotice({ player, panel }: Pick<SlotProps, 'player' | 'panel'>) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <>
      <Text style={styles.waitingText}>
        Waiting for {player.name} to play…
        {panel.disconnectedPlayerIds.includes(player.id) ? ' (disconnected)' : ''}
      </Text>
      {panel.removablePlayerIds.includes(player.id) && (
        <IconButton
          title={`Remove ${player.name}`}
          icon="account-remove"
          onPress={() => {
            panel.onRemovePlayer(player.id);
          }}
          color={theme.danger}
        />
      )}
    </>
  );
}

function JailAndDebtButtons({ buttons, panel }: Pick<SlotProps, 'buttons' | 'panel'>) {
  const theme = useTheme();
  return (
    <>
      {buttons.payFine.visible && (
        <IconButton
          title="Pay Fine ($50)"
          icon="cash-remove"
          onPress={panel.onPayFine}
          disabled={!buttons.payFine.enabled}
          color={theme.danger}
        />
      )}
      {buttons.useGOOJCard.visible && (
        <IconButton
          title={`Use Card (${buttons.useGOOJCard.count})`}
          icon="card-account-details"
          onPress={panel.onUseGOOJCard}
          color={theme.info}
        />
      )}
      {buttons.declareBankruptcy.visible && (
        <IconButton
          title="Declare Bankruptcy"
          icon="alert-circle"
          onPress={panel.onDeclareBankruptcy}
          color={theme.neutralButton}
        />
      )}
    </>
  );
}

function TurnButtons({ buttons, panel }: Pick<SlotProps, 'buttons' | 'panel'>) {
  const theme = useTheme();
  return (
    <>
      {buttons.roll.visible && (
        <IconButton title="Roll Dice" icon="dice-5" onPress={panel.onRoll} />
      )}
      {buttons.rollAgain.visible && (
        <IconButton
          title="Roll Again"
          icon="dice-multiple"
          onPress={panel.onRollAgain}
          color={theme.warning}
        />
      )}
      {buttons.endTurn.visible && (
        <IconButton title="End Turn" icon="check" onPress={panel.onEndTurn} color={theme.danger} />
      )}
    </>
  );
}

/**
 * Fixed slots, so Manage Properties and the turn button keep their y-position
 * from one step to the next (#268): the decision zone holds whatever the player
 * must settle first (buy or auction, jail options, who we wait for), then
 * Manage, then the single roll / roll again / end turn button.
 */
export function TurnActions({ player, buttons, panel }: SlotProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.actions}>
      <View style={styles.decisionSlot}>
        {buttons.waiting.visible && <WaitingNotice player={player} panel={panel} />}
        <JailAndDebtButtons buttons={buttons} panel={panel} />
        {buttons.buy.visible && (
          <IconButton title={`Buy ($${buttons.buy.price})`} icon="cart" onPress={panel.onBuy} />
        )}
        {buttons.auction.visible && (
          <IconButton
            title="Auction"
            icon="gavel"
            onPress={panel.onDeclineBuy}
            color={theme.warning}
          />
        )}
      </View>
      <View style={styles.buttonSlot}>
        {buttons.manage.visible && (
          <IconButton
            title="Manage Properties"
            icon="city"
            onPress={panel.onOpenPropertyManager}
            color={theme.brand}
          />
        )}
      </View>
      <View style={styles.buttonSlot}>
        <TurnButtons buttons={buttons} panel={panel} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    actions: { gap: 8, width: '100%' },
    // Two medium buttons (Buy + Auction) and the gap between them.
    decisionSlot: { minHeight: 96, gap: 8 },
    buttonSlot: { minHeight: 44, justifyContent: 'center' },
    waitingText: {
      color: theme.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 12,
    },
  });
