import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { GROUP_COLORS } from '../../constants';
import { getPlayerPositionLabel } from '../jail-status';
import { IconButton } from '../ui/IconButton';
import { GOOJBadge } from '../ui/GOOJBadge';
import { JailStatus } from '../ui/JailStatus';
import { Dice } from '../Dice';
import { GameOverCard } from './GameOverCard';
import { PlayerList } from './PlayerList';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

interface Props extends StatusPanelProps {
  /** False when the layout shows the Players list under the board instead. */
  showPlayerList: boolean;
}

export const TabletCenter: React.FC<Props> = ({
  showPlayerList,
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

  // A finished game with an unresolvable winner has no `currentPlayer` but must
  // still render the game-over card (same fallback as Peek).
  if (!currentPlayer && !isGameOver) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}>
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
        {showPlayerList && (
          <PlayerList
            state={state}
            myPlayerId={myPlayerId}
            activePlayerId={currentPlayer?.id}
            isGameOver={isGameOver}
            disconnectedPlayerIds={disconnectedPlayerIds}
            removablePlayerIds={removablePlayerIds}
            onRemovePlayer={onRemovePlayer}
            onOpenTrade={onOpenTrade}
          />
        )}

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
              {/* Reserved even before the first roll so the dice appearing does not push
                  the buttons below down (#268). */}
              <View style={styles.diceSlot}>
                {state.phase === 'action' && (
                  <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
                )}
              </View>
            </View>

            {/* Fixed slots, so Manage Properties and the turn button keep their y-position
                from one step to the next (#268): the decision zone holds whatever the
                player must settle first (buy or auction, jail options, who we wait for),
                then Manage, then the single roll / roll again / end turn button. */}
            <View style={styles.actions}>
              <View style={styles.decisionSlot}>
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
              </View>
              <View style={styles.buttonSlot}>
                {buttons.manage.visible && (
                  <IconButton
                    title="Manage Properties"
                    icon="city"
                    onPress={onOpenPropertyManager}
                    color="#841584"
                  />
                )}
              </View>
              <View style={styles.buttonSlot}>
                {buttons.roll.visible && (
                  <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />
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
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // The board's center slot is a bounded box, so the panel scrolls when large
  // Dynamic Type outgrows it instead of spilling over the tiles. alignSelf
  // stretch because that slot centres (and so shrink-wraps) its child.
  scroll: { alignSelf: 'stretch', flex: 1 },
  // Top-aligned so the controls do not move as the panel's height changes (#268).
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
