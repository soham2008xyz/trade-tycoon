import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import { GameOverCard } from './GameOverCard';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { useStatusPanelActions, type StatusPanelButtons } from '../../hooks/useStatusPanelActions';
import type { Player, StatusPanelProps, Tile } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';
import { formatMoney } from '../format-money';
import { PlayerMarker } from '../PlayerMarker';
import { GameTimerBadge } from '../ui/TurnTimerBadge';

interface PeekPartProps {
  panel: StatusPanelProps;
}

interface PeekHeaderProps extends PeekPartProps {
  player: Player;
}

/** The active player's name chip (money, held cards) and, in the action phase, the dice. */
const PeekHeader: React.FC<PeekHeaderProps> = ({ panel, player }) => {
  const styles = createStyles(useTheme());
  const { state, isTokenMoving } = panel;
  return (
    <View style={styles.headerRow}>
      <View style={styles.playerChip}>
        <PlayerMarker color={player.color} size={16} />
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.money}>{formatMoney(player.money)}</Text>
        <GOOJBadge count={player.getOutOfJailCards} />
      </View>
      {state.phase === 'action' && (
        <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
      )}
    </View>
  );
};

interface PositionRowProps {
  player: Player;
  tile: Tile | null;
  isTokenMoving: boolean;
}

/** Where the active player is standing, with the tile's group color while they are not moving. */
const PositionRow: React.FC<PositionRowProps> = ({ player, tile, isTokenMoving }) => {
  const styles = createStyles(useTheme());
  const groupColor = tile?.group ? GROUP_COLORS[tile.group] : undefined;
  return (
    <View style={styles.positionRow}>
      <Text style={styles.positionLabel}>Position: </Text>
      {!isTokenMoving && groupColor && (
        <View style={[styles.tileColor, { backgroundColor: groupColor }]} />
      )}
      <Text style={styles.positionText}>
        {isTokenMoving ? '…' : getPlayerPositionLabel(player, tile?.name)}
      </Text>
    </View>
  );
};

/** "Waiting for X…", with a Remove button when the local user may drop them. */
const WaitingNotice: React.FC<PeekHeaderProps> = ({ panel, player }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { disconnectedPlayerIds, removablePlayerIds, onRemovePlayer } = panel;
  return (
    <>
      <Text style={styles.waitingText}>
        Waiting for {player.name}…
        {disconnectedPlayerIds.includes(player.id) ? ' (disconnected)' : ''}
      </Text>
      {removablePlayerIds.includes(player.id) && (
        <IconButton
          title={`Remove ${player.name}`}
          icon="account-remove"
          onPress={() => onRemovePlayer(player.id)}
          color={theme.danger}
        />
      )}
    </>
  );
};

interface PeekButtonsProps extends PeekPartProps {
  buttons: StatusPanelButtons;
}

/** The roll-phase buttons: roll, the two ways out of jail, and bankruptcy. */
const RollPhaseButtons: React.FC<PeekButtonsProps> = ({ panel, buttons }) => {
  const theme = useTheme();
  return (
    <>
      {buttons.roll.visible && (
        <IconButton title="Roll Dice" icon="dice-5" onPress={panel.onRoll} />
      )}
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
};

/** The action-phase buttons: buy or auction, manage, roll again and end turn. */
const ActionPhaseButtons: React.FC<PeekButtonsProps> = ({ panel, buttons }) => {
  const theme = useTheme();
  return (
    <>
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
      {buttons.manage.visible && (
        <IconButton
          title="Manage"
          icon="city"
          onPress={panel.onOpenPropertyManager}
          color={theme.brand}
        />
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
};

export const Peek: React.FC<StatusPanelProps> = (props) => {
  const { state, myPlayerId, isMultiplayer, onNewGame, onBackToMenu, isTokenMoving } = props;
  const styles = createStyles(useTheme());
  const { currentPlayer, currentTile, buttons, isGameOver } = useStatusPanelActions(
    state,
    myPlayerId,
    isTokenMoving
  );

  if (isGameOver) {
    return (
      <View style={styles.root}>
        <GameOverCard
          state={state}
          myPlayerId={myPlayerId}
          isMultiplayer={isMultiplayer}
          onNewGame={onNewGame}
          onBackToMenu={onBackToMenu}
        />
      </View>
    );
  }

  if (!currentPlayer) return null;

  return (
    <View style={styles.root}>
      <PeekHeader panel={props} player={currentPlayer} />
      <GameTimerBadge state={state} myPlayerId={myPlayerId} />
      <PositionRow player={currentPlayer} tile={currentTile} isTokenMoving={isTokenMoving} />
      <JailStatus player={currentPlayer} showHint={true} />
      <View style={styles.actions}>
        {buttons.waiting.visible && <WaitingNotice panel={props} player={currentPlayer} />}
        <RollPhaseButtons panel={props} buttons={buttons} />
        <ActionPhaseButtons panel={props} buttons={buttons} />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { padding: 12, gap: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    // flexShrink + wrap: the chip shares a row with the dice, and large Dynamic
    // Type must wrap the name/money/badge rather than push the dice off-screen.
    playerChip: {
      flexShrink: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 6,
      rowGap: 2,
    },
    playerName: { fontWeight: '700', fontSize: 14, color: theme.textPrimary },
    money: { color: theme.textSecondary, fontSize: 13 },
    // The text shrinks (rather than the row wrapping) so a long tile name at
    // large Dynamic Type wraps in place instead of running off the right edge.
    positionRow: { flexDirection: 'row', alignItems: 'center' },
    positionLabel: { fontSize: 12, color: theme.textSecondary },
    tileColor: {
      width: 10,
      height: 10,
      marginRight: 4,
      borderWidth: 1,
      borderColor: theme.outline,
    },
    positionText: { fontSize: 13, flexShrink: 1, color: theme.textPrimary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    waitingText: {
      color: theme.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 8,
    },
  });
