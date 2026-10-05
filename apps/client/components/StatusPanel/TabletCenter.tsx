import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { DisconnectedBadge } from '../ui/DisconnectedBadge';
import { Dice } from '../Dice';
import { GameOverCard } from './GameOverCard';
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
  isMultiplayer,
  onNewGame,
  onBackToMenu,
  isTokenMoving,
  disconnectedPlayerIds,
  removablePlayerIds,
  onRemovePlayer,
}) => {
  const { currentPlayer, currentTile, buttons, isGameOver } = useStatusPanelActions(
    state,
    myPlayerId,
    isTokenMoving
  );
  const selfId = myPlayerId;

  // A finished game with an unresolvable winner has no `currentPlayer` but must
  // still render the game-over card (same fallback as Peek).
  if (!currentPlayer && !isGameOver) return null;

  return (
    <View style={styles.root}>
      <View style={styles.topButtons}>
        {!isGameOver && (
          <IconButton
            title="Restart"
            icon="restart"
            onPress={onRestart}
            color="#666"
            size="small"
          />
        )}
        <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          {state.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                <View style={styles.playerLabel}>
                  <Text
                    style={[
                      styles.playerText,
                      currentPlayer?.id === player.id && styles.activePlayerText,
                    ]}
                  >
                    {player.name} (${player.money}){state.winner === player.id ? ' 🏆' : ''}
                  </Text>
                  <GOOJBadge count={player.getOutOfJailCards} />
                  <JailStatus player={player} />
                  {disconnectedPlayerIds.includes(player.id) && (
                    <DisconnectedBadge name={player.name} />
                  )}
                </View>
              </View>
              {removablePlayerIds.includes(player.id) && (
                <View style={{ marginLeft: 10 }}>
                  <IconButton
                    title="Remove"
                    icon="account-remove"
                    onPress={() => onRemovePlayer(player.id)}
                    color="#d9534f"
                    size="small"
                  />
                </View>
              )}
              {/* The reducer ignores PROPOSE_TRADE after a win. */}
              {!isGameOver && player.id !== selfId && (
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

        {isGameOver || !currentPlayer ? (
          <GameOverCard
            state={state}
            myPlayerId={myPlayerId}
            isMultiplayer={isMultiplayer}
            onNewGame={onNewGame}
            onBackToMenu={onBackToMenu}
          />
        ) : (
          <>
            <View style={styles.gameInfo}>
              <View style={styles.currentPlayerInfo}>
                <Text style={styles.statusText}>Current: </Text>
                <View style={[styles.playerColor, { backgroundColor: currentPlayer.color }]} />
                <Text style={styles.statusText}>{currentPlayer.name}</Text>
                <GOOJBadge count={currentPlayer.getOutOfJailCards} />
              </View>
              <View style={styles.currentTileInfo}>
                <Text style={styles.statusText}>Position: </Text>
                {!isTokenMoving && currentTile?.group && GROUP_COLORS[currentTile.group] && (
                  <View
                    style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]}
                  />
                )}
                <Text style={[styles.statusText, styles.positionText]}>
                  {isTokenMoving ? '...' : getPlayerPositionLabel(currentPlayer, currentTile?.name)}
                </Text>
              </View>
              <JailStatus player={currentPlayer} showHint />
              {state.phase === 'action' && (
                <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
              )}
            </View>

            <View style={styles.actions}>
              {buttons.waiting.visible && (
                <>
                  <Text style={styles.waitingText}>
                    Waiting for {currentPlayer.name} to play…
                    {disconnectedPlayerIds.includes(currentPlayer.id) ? ' (disconnected)' : ''}
                  </Text>
                  {removablePlayerIds.includes(currentPlayer.id) && (
                    <IconButton
                      title={`Remove ${currentPlayer.name}`}
                      icon="account-remove"
                      onPress={() => onRemovePlayer(currentPlayer.id)}
                      color="#d9534f"
                    />
                  )}
                </>
              )}
              {buttons.roll.visible && (
                <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />
              )}
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
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // width: 100% because the board's center slot centres (and so shrink-wraps)
  // its child; without it large Dynamic Type squeezes the player rows.
  root: { width: '100%', alignItems: 'center', padding: 20 },
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
  // flex: 1 + shrinking label keeps the Trade button inside the 300px panel
  // when large Dynamic Type makes the name wrap.
  playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  playerLabel: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
  },
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2, flexShrink: 0 },
  // flexShrink lets a long "Name ($money)" wrap inside the label instead of
  // being clipped at large Dynamic Type.
  playerText: { fontSize: 14, flexShrink: 1 },
  activePlayerText: { fontWeight: 'bold' },
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
  waitingText: {
    color: '#aab8c2',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
