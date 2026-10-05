import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Player } from '@trade-tycoon/game-logic';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import type { StatusPanelActions, StatusPanelButtons } from '../../hooks/useStatusPanelActions';
import { GameOverCard } from './GameOverCard';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';

interface TurnInfoProps {
  player: Player;
  /** Name of the tile the player stands on; undefined when unknown. */
  tileName?: string;
  /** Group key of that tile, for its colour swatch; undefined for non-streets. */
  tileGroup?: string;
  panel: StatusPanelProps;
}

/** Who is playing, where they stand and the dice, for the tablet board centre. */
function TurnInfo({ player, tileName, tileGroup, panel }: TurnInfoProps) {
  const styles = createStyles(useTheme());
  // Looked up through entries(), not GROUP_COLORS[tileGroup], to avoid a generic object injection sink.
  const groupColor = Object.entries(GROUP_COLORS).find(([group]) => group === tileGroup)?.[1];
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
          {panel.isTokenMoving ? '...' : getPlayerPositionLabel(player, tileName)}
        </Text>
      </View>
      <JailStatus player={player} showHint />
      <DiceSlot panel={panel} />
    </View>
  );
}

/** Reserved even before the first roll so the dice appearing does not push the buttons below down (#268). */
function DiceSlot({ panel }: { panel: StatusPanelProps }) {
  const styles = createStyles(useTheme());
  return (
    <View style={styles.diceSlot}>
      {panel.state.phase === 'action' && (
        <Dice
          value1={panel.state.dice[0]}
          value2={panel.state.dice[1]}
          isRolling={panel.isTokenMoving}
        />
      )}
    </View>
  );
}

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
function TurnActions({ player, buttons, panel }: SlotProps) {
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

interface TurnPanelProps {
  panel: StatusPanelProps;
  actions: StatusPanelActions;
}

/** Everything under the Players list: the game-over card, or the turn info and its buttons. */
export function TurnPanel({ panel, actions }: TurnPanelProps) {
  const { currentPlayer, currentTile, buttons, isGameOver } = actions;
  if (isGameOver || !currentPlayer) {
    return (
      <GameOverCard
        state={panel.state}
        myPlayerId={panel.myPlayerId}
        isMultiplayer={panel.isMultiplayer}
        onNewGame={panel.onNewGame}
        onBackToMenu={panel.onBackToMenu}
      />
    );
  }
  return (
    <>
      <TurnInfo
        player={currentPlayer}
        tileName={currentTile?.name}
        tileGroup={currentTile?.group}
        panel={panel}
      />
      <TurnActions player={currentPlayer} buttons={buttons} panel={panel} />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    statusText: { fontSize: 14, color: theme.textPrimary },
    // Shrinks so a long tile name wraps in place at large Dynamic Type instead
    // of overflowing the panel (same pattern as Peek).
    positionText: { flexShrink: 1 },
    tileColor: {
      width: 12,
      height: 12,
      marginRight: 6,
      borderWidth: 1,
      borderColor: theme.outline,
    },
    actions: { gap: 8, width: '100%' },
    // Dice are 40px tall plus padding; reserve that height before they appear.
    diceSlot: { minHeight: 50, justifyContent: 'center' },
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
