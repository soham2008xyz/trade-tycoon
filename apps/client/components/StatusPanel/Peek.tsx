import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { Dice } from '../Dice';
import { GROUP_COLORS } from '../../constants';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

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
  isTokenMoving,
}) => {
  const { currentPlayer, currentTile, buttons } = useStatusPanelActions(
    state,
    myPlayerId,
    isTokenMoving
  );

  if (!currentPlayer) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.playerChip}>
          <View style={[styles.dot, { backgroundColor: currentPlayer.color }]} />
          <Text style={styles.playerName}>{currentPlayer.name}</Text>
          <Text style={styles.money}>${currentPlayer.money}</Text>
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
        <Text style={styles.positionText}>{isTokenMoving ? '…' : currentTile?.name}</Text>
      </View>

      <View style={styles.actions}>
        {buttons.waiting.visible && (
          <Text style={styles.waitingText}>Waiting for {currentPlayer.name}…</Text>
        )}
        {buttons.roll.visible && <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />}
        {buttons.payFine.visible && (
          <IconButton
            title="Pay Fine ($50)"
            icon="cash-remove"
            onPress={onPayFine}
            disabled={!buttons.payFine.enabled}
            color="#d9534f"
          />
        )}
        {buttons.useGOOJCard.visible && (
          <IconButton
            title={`Use Card (${buttons.useGOOJCard.count})`}
            icon="card-account-details"
            onPress={onUseGOOJCard}
            color="#5bc0de"
          />
        )}
        {buttons.declareBankruptcy.visible && (
          <IconButton
            title="Declare Bankruptcy"
            icon="alert-circle"
            onPress={onDeclareBankruptcy}
            color="#444"
          />
        )}
        {buttons.buy.visible && (
          <IconButton title={`Buy ($${buttons.buy.price})`} icon="cart" onPress={onBuy} />
        )}
        {buttons.auction.visible && (
          <IconButton title="Auction" icon="gavel" onPress={onDeclineBuy} color="#f0ad4e" />
        )}
        {buttons.manage.visible && (
          <IconButton title="Manage" icon="city" onPress={onOpenPropertyManager} color="#841584" />
        )}
        {buttons.rollAgain.visible && (
          <IconButton
            title="Roll Again"
            icon="dice-multiple"
            onPress={onRollAgain}
            color="orange"
          />
        )}
        {buttons.endTurn.visible && (
          <IconButton title="End Turn" icon="check" onPress={onEndTurn} color="#d9534f" />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: 12, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { fontWeight: '700', fontSize: 14 },
  money: { color: '#666', fontSize: 13 },
  positionRow: { flexDirection: 'row', alignItems: 'center' },
  positionLabel: { fontSize: 12, color: '#666' },
  tileColor: { width: 10, height: 10, marginRight: 4, borderWidth: 1, borderColor: '#333' },
  positionText: { fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waitingText: { color: '#aab8c2', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});
