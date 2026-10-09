import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import { GameOverCard } from './GameOverCard';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../constants/theme';
import { formatMoney } from '../format-money';
import { PlayerMarker } from '../PlayerMarker';

export const Peek: React.FC<StatusPanelProps> = ({
  state,
  myPlayerId,
  onRoll,
  onBuy,
  onDeclineBuy,
  onEndTurn,
  onRollAgain,
  onPayFine,
  onUseGOOJCard,
  onDeclareBankruptcy,
  onOpenPropertyManager,
  isMultiplayer,
  onNewGame,
  onBackToMenu,
  isTokenMoving,
  disconnectedPlayerIds,
  removablePlayerIds,
  onRemovePlayer,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
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
      <View style={styles.headerRow}>
        <View style={styles.playerChip}>
          <PlayerMarker color={currentPlayer.color} size={16} />
          <Text style={styles.playerName}>{currentPlayer.name}</Text>
          <Text style={styles.money}>{formatMoney(currentPlayer.money)}</Text>
          <GOOJBadge count={currentPlayer.getOutOfJailCards} />
        </View>
        {state.phase === 'action' && (
          <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
        )}
      </View>

      <View style={styles.positionRow}>
        <Text style={styles.positionLabel}>Position: </Text>
        {!isTokenMoving && currentTile?.group && GROUP_COLORS[currentTile.group] && (
          <View style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]} />
        )}
        <Text style={styles.positionText}>
          {isTokenMoving ? '…' : getPlayerPositionLabel(currentPlayer, currentTile?.name)}
        </Text>
      </View>

      <JailStatus player={currentPlayer} showHint />

      <View style={styles.actions}>
        {buttons.waiting.visible && (
          <>
            <Text style={styles.waitingText}>
              Waiting for {currentPlayer.name}…
              {disconnectedPlayerIds.includes(currentPlayer.id) ? ' (disconnected)' : ''}
            </Text>
            {removablePlayerIds.includes(currentPlayer.id) && (
              <IconButton
                title={`Remove ${currentPlayer.name}`}
                icon="account-remove"
                onPress={() => onRemovePlayer(currentPlayer.id)}
                color={theme.danger}
              />
            )}
          </>
        )}
        {buttons.roll.visible && <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />}
        {buttons.payFine.visible && (
          <IconButton
            title="Pay Fine ($50)"
            icon="cash-remove"
            onPress={onPayFine}
            disabled={!buttons.payFine.enabled}
            color={theme.danger}
          />
        )}
        {buttons.useGOOJCard.visible && (
          <IconButton
            title={`Use Card (${buttons.useGOOJCard.count})`}
            icon="card-account-details"
            onPress={onUseGOOJCard}
            color={theme.info}
          />
        )}
        {buttons.declareBankruptcy.visible && (
          <IconButton
            title="Declare Bankruptcy"
            icon="alert-circle"
            onPress={onDeclareBankruptcy}
            color={theme.neutralButton}
          />
        )}
        {buttons.buy.visible && (
          <IconButton title={`Buy ($${buttons.buy.price})`} icon="cart" onPress={onBuy} />
        )}
        {buttons.auction.visible && (
          <IconButton title="Auction" icon="gavel" onPress={onDeclineBuy} color={theme.warning} />
        )}
        {buttons.manage.visible && (
          <IconButton
            title="Manage"
            icon="city"
            onPress={onOpenPropertyManager}
            color={theme.brand}
          />
        )}
        {buttons.rollAgain.visible && (
          <IconButton
            title="Roll Again"
            icon="dice-multiple"
            onPress={onRollAgain}
            color={theme.warning}
          />
        )}
        {buttons.endTurn.visible && (
          <IconButton title="End Turn" icon="check" onPress={onEndTurn} color={theme.danger} />
        )}
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
