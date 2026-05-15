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
  const { isMyTurn, currentPlayer, currentTile, canBuy, canAuction } = useStatusPanelActions(
    state,
    myPlayerId
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
          <View
            style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]}
          />
        )}
        <Text style={styles.positionText}>{isTokenMoving ? '…' : currentTile?.name}</Text>
      </View>

      <View style={styles.actions}>
        {isMyTurn ? (
          <>
            {state.phase === 'roll' && (
              <>
                <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />
                {currentPlayer.isInJail && (
                  <>
                    <IconButton
                      title="Pay Fine ($50)"
                      icon="cash-remove"
                      onPress={onPayFine}
                      disabled={currentPlayer.money < 50}
                      color="#d9534f"
                    />
                    {currentPlayer.getOutOfJailCards > 0 && (
                      <IconButton
                        title={`Use Card (${currentPlayer.getOutOfJailCards})`}
                        icon="card-account-details"
                        onPress={onUseGOOJCard}
                        color="#5bc0de"
                      />
                    )}
                  </>
                )}
              </>
            )}
            {currentPlayer.money < 0 && (
              <IconButton
                title="Declare Bankruptcy"
                icon="alert-circle"
                onPress={onDeclareBankruptcy}
                color="#444"
              />
            )}
            {state.phase === 'action' && (
              <>
                {canBuy && !isTokenMoving && (
                  <IconButton
                    title={`Buy ($${currentTile?.price || 0})`}
                    icon="cart"
                    onPress={onBuy}
                  />
                )}
                {canAuction && !isTokenMoving && (
                  <IconButton
                    title="Auction"
                    icon="gavel"
                    onPress={onDeclineBuy}
                    color="#f0ad4e"
                  />
                )}
                {state.doublesCount === 0 && !isTokenMoving && (
                  <IconButton
                    title="Manage"
                    icon="city"
                    onPress={onOpenPropertyManager}
                    color="#841584"
                  />
                )}
                {state.doublesCount > 0
                  ? !isTokenMoving && (
                      <IconButton
                        title="Roll Again"
                        icon="dice-multiple"
                        onPress={onRollAgain}
                        color="orange"
                      />
                    )
                  : !isTokenMoving && (
                      <IconButton
                        title="End Turn"
                        icon="check"
                        onPress={onEndTurn}
                        color="#d9534f"
                      />
                    )}
              </>
            )}
          </>
        ) : (
          <Text style={styles.waitingText}>Waiting for {currentPlayer.name}…</Text>
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
