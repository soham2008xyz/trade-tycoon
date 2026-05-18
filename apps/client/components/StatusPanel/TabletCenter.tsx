import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GROUP_COLORS } from '../../constants';
import { IconButton } from '../ui/IconButton';
import { Dice } from '../Dice';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

export const TabletCenter: React.FC<StatusPanelProps> = ({
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
  onShowLog,
  onRestart,
  onOpenPropertyManager,
  onOpenTrade,
  isTokenMoving,
}) => {
  const { currentPlayer, currentTile, buttons } = useStatusPanelActions(
    state,
    myPlayerId,
    isTokenMoving
  );
  const selfId = myPlayerId;

  if (!currentPlayer) return null;

  return (
    <View style={styles.root}>
      <View style={styles.topButtons}>
        <IconButton title="Restart" icon="restart" onPress={onRestart} color="#666" size="small" />
        <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          {state.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                <Text
                  style={[
                    styles.playerText,
                    currentPlayer.id === player.id && styles.activePlayerText,
                  ]}
                >
                  {player.name} (${player.money})
                </Text>
              </View>
              {player.id !== selfId && (
                <View style={{ marginLeft: 10 }}>
                  <IconButton
                    title="Trade"
                    icon="handshake"
                    onPress={() => onOpenTrade(player.id)}
                    size="small"
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.gameInfo}>
          <View style={styles.currentPlayerInfo}>
            <Text style={styles.statusText}>Current: </Text>
            <View style={[styles.playerColor, { backgroundColor: currentPlayer.color }]} />
            <Text style={styles.statusText}>{currentPlayer.name}</Text>
          </View>
          <View style={styles.currentTileInfo}>
            <Text style={styles.statusText}>Position: </Text>
            {!isTokenMoving && currentTile?.group && GROUP_COLORS[currentTile.group] && (
              <View
                style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]}
              />
            )}
            <Text style={styles.statusText}>{isTokenMoving ? '...' : currentTile?.name}</Text>
          </View>
          {state.phase === 'action' && (
            <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
          )}
        </View>

        <View style={styles.actions}>
          {buttons.waiting.visible && (
            <Text style={styles.waitingText}>Waiting for {currentPlayer.name} to play…</Text>
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
            <IconButton
              title="Manage Properties"
              icon="city"
              onPress={onOpenPropertyManager}
              color="#841584"
            />
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { alignItems: 'center', padding: 20 },
  topButtons: { flexDirection: 'row', gap: 10, marginBottom: 10, zIndex: 20 },
  statusPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  playerList: { marginBottom: 15, width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center' },
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2 },
  playerText: { fontSize: 14 },
  activePlayerText: { fontWeight: 'bold' },
  gameInfo: { marginBottom: 15, alignItems: 'center', gap: 4 },
  currentPlayerInfo: { flexDirection: 'row', alignItems: 'center' },
  currentTileInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 14 },
  tileColor: { width: 12, height: 12, marginRight: 6, borderWidth: 1, borderColor: '#333' },
  actions: { gap: 8, width: '100%' },
  waitingText: {
    color: '#aab8c2',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
