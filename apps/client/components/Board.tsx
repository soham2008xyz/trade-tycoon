import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import {
  BOARD,
  Player,
  Tile as TileType,
  TradeRequest,
  TradeOffer,
} from '@trade-tycoon/game-logic';
import { Tile } from './Tile';
import { PropertyManager } from './PropertyManager';
import { AuctionModal } from './AuctionModal';
import { TradeModal } from './TradeModal';
import { TileInfoModal } from './TileInfoModal';
import { IconButton } from './ui/IconButton';
import { Dice } from './Dice';
import { PlayerToken } from './PlayerToken';

const CORNER_SIZE_PCT = 14;

interface Props {
  players: Player[];
  currentPlayer: Player | undefined;
  currentTile: TileType | null;
  dice: [number, number];
  doublesCount: number;
  phase: 'roll' | 'action' | 'end' | 'auction';
  auction?: import('@trade-tycoon/game-logic').AuctionState | null;
  activeTrade?: TradeRequest | null;
  canBuy: boolean;
  canAuction: boolean;
  onRoll: () => void;
  onBuy: () => void;
  onDeclineBuy: () => void;
  onBid: (playerId: string, amount: number) => void;
  onConcedeAuction: (playerId: string) => void;
  onEndTurn: () => void;
  onRollAgain: () => void;
  onBuild: (propertyId: string) => void;
  onSell: (propertyId: string) => void;
  onMortgage: (propertyId: string) => void;
  onUnmortgage: (propertyId: string) => void;
  onPayFine: () => void;
  onUseGOOJCard: () => void;
  onRestart: () => void;
  onShowLog: () => void;
  onDeclareBankruptcy: () => void;
  onProposeTrade: (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => void;
  onAcceptTrade: (tradeId: string) => void;
  onRejectTrade: (tradeId: string) => void;
  onCancelTrade: (tradeId: string) => void;
}

export const Board: React.FC<Props> = ({
  players,
  currentPlayer,
  currentTile,
  dice,
  doublesCount,
  phase,
  auction,
  activeTrade,
  canBuy,
  canAuction,
  onRoll,
  onBuy,
  onDeclineBuy,
  onBid,
  onConcedeAuction,
  onEndTurn,
  onRollAgain,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
  onPayFine,
  onUseGOOJCard,
  onRestart,
  onShowLog,
  onDeclareBankruptcy,
  onProposeTrade,
  onAcceptTrade,
  onRejectTrade,
  onCancelTrade,
}) => {
  const { width, height } = useWindowDimensions();
  const [showPropertyManager, setShowPropertyManager] = useState(false);
  const [tradeTargetId, setTradeTargetId] = useState<string | undefined>(undefined);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isTokenMoving, setIsTokenMoving] = useState(false);
  const size = Math.min(width, height) - 20; // Padding

  // Slice the board into sections
  const bottomRow = [
    BOARD[9],
    BOARD[8],
    BOARD[7],
    BOARD[6],
    BOARD[5],
    BOARD[4],
    BOARD[3],
    BOARD[2],
    BOARD[1],
  ];
  const leftRow = [
    BOARD[19],
    BOARD[18],
    BOARD[17],
    BOARD[16],
    BOARD[15],
    BOARD[14],
    BOARD[13],
    BOARD[12],
    BOARD[11],
  ];
  const topRow = [
    BOARD[21],
    BOARD[22],
    BOARD[23],
    BOARD[24],
    BOARD[25],
    BOARD[26],
    BOARD[27],
    BOARD[28],
    BOARD[29],
  ];
  const rightRow = [
    BOARD[31],
    BOARD[32],
    BOARD[33],
    BOARD[34],
    BOARD[35],
    BOARD[36],
    BOARD[37],
    BOARD[38],
    BOARD[39],
  ];

  const corners = {
    go: BOARD[0],
    jail: BOARD[10],
    parking: BOARD[20],
    gotojail: BOARD[30],
  };

  const getPlayersOnTile = (index: number) => players.filter((p) => p.position === index);
  const getOwner = (tileId: string) => players.find((p) => p.properties.includes(tileId));

  const GROUP_COLORS: Record<string, string> = {
    brown: '#955436',
    light_blue: '#AAE0FA',
    pink: '#D93A96',
    orange: '#F7941D',
    red: '#ED1B24',
    yellow: '#FEF200',
    green: '#1FB25A',
    dark_blue: '#0072BB',
    railroad: '#000000',
    utility: '#A0A0A0',
  };

  return (
    <View style={[styles.boardContainer, { width: size, height: size }]}>
      {/* Center Logo Area */}
      <View style={styles.center}>
        <View style={styles.topButtons}>
          <IconButton
            title="Restart"
            icon="restart"
            onPress={onRestart}
            color="#666"
            size="small"
          />
          <IconButton
            title="Log"
            icon="script-text"
            onPress={onShowLog}
            color="#666"
            size="small"
          />
        </View>

        <View style={styles.statusPanel}>
          {currentPlayer && (
            <>
              <View style={styles.playerList}>
                <Text style={styles.sectionTitle}>Players</Text>
                {players.map((player) => (
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
                    <View
                      style={{
                        marginLeft: 10,
                        opacity: player.id !== currentPlayer.id ? 1 : 0,
                      }}
                      pointerEvents={player.id !== currentPlayer.id ? 'auto' : 'none'}
                    >
                      <IconButton
                        title="Trade"
                        icon="handshake"
                        onPress={() => setTradeTargetId(player.id)}
                        size="small"
                      />
                    </View>
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
                      style={[
                        styles.tileColor,
                        { backgroundColor: GROUP_COLORS[currentTile.group] },
                      ]}
                    />
                  )}
                  <Text style={styles.statusText}>
                    {isTokenMoving ? '...' : currentTile?.name}
                  </Text>
                </View>
                {phase === 'action' && (
                  <Dice
                    value1={dice[0]}
                    value2={dice[1]}
                    isRolling={isTokenMoving}
                  />
                )}
              </View>

              <View style={styles.actions}>
                {phase === 'roll' && (
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

                {phase === 'action' && (
                  <>
                    {canBuy && (
                      <IconButton
                        title={`Buy ($${currentTile?.price || 0})`}
                        icon="cart"
                        onPress={onBuy}
                      />
                    )}
                    {canAuction && (
                      <IconButton
                        title="Auction"
                        icon="gavel"
                        onPress={onDeclineBuy}
                        color="#f0ad4e"
                      />
                    )}
                    {doublesCount === 0 && (
                      <IconButton
                        title="Manage Properties"
                        icon="city"
                        onPress={() => setShowPropertyManager(true)}
                        color="#841584"
                      />
                    )}
                    {doublesCount > 0 ? (
                      <IconButton
                        title="Roll Again"
                        icon="dice-multiple"
                        onPress={onRollAgain}
                        color="orange"
                      />
                    ) : (
                      <IconButton
                        title="End Turn"
                        icon="check"
                        onPress={onEndTurn}
                        color="#d9534f"
                      />
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      <AuctionModal
        visible={phase === 'auction'}
        auction={auction || null}
        players={players}
        onBid={onBid}
        onConcede={onConcedeAuction}
        boardSize={size}
      />

      {/* Render Animated Player Tokens */}
      {players.map((player, index) => (
        <PlayerToken
          key={player.id}
          player={player}
          boardSize={size}
          index={index}
          onAnimationStart={() => setIsTokenMoving(true)}
          onAnimationComplete={() => setIsTokenMoving(false)}
        />
      ))}

      {currentPlayer && (
        <TradeModal
          visible={
            !!tradeTargetId ||
            (!!activeTrade &&
              (activeTrade.initiatorId === currentPlayer.id ||
                activeTrade.targetPlayerId === currentPlayer.id))
          }
          players={players}
          currentPlayerId={currentPlayer.id}
          targetPlayerId={tradeTargetId || activeTrade?.targetPlayerId}
          activeTrade={activeTrade}
          onPropose={(t, o, r) => {
            onProposeTrade(t, o, r);
            setTradeTargetId(undefined); // Close the proposal modal, but activeTrade will keep Pending modal open
          }}
          onAccept={onAcceptTrade}
          onReject={onRejectTrade}
          onCancel={(id) => {
            onCancelTrade(id);
            setTradeTargetId(undefined);
          }}
          onClose={() => setTradeTargetId(undefined)}
          boardSize={size}
        />
      )}

      {/* Property Manager Modal */}
      {currentPlayer && (
        <PropertyManager
          visible={showPropertyManager}
          player={currentPlayer}
          onClose={() => setShowPropertyManager(false)}
          onBuild={onBuild}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
        />
      )}

      {/* Corners */}
      <View style={[styles.corner, styles.bottomRight]}>
        <Tile
          tile={corners.go}
          orientation="corner"
          onPress={() => setSelectedTileId(corners.go.id)}
        />
      </View>
      <View style={[styles.corner, styles.bottomLeft]}>
        <Tile
          tile={corners.jail}
          orientation="corner"
          onPress={() => setSelectedTileId(corners.jail.id)}
        />
      </View>
      <View style={[styles.corner, styles.topLeft]}>
        <Tile
          tile={corners.parking}
          orientation="corner"
          onPress={() => setSelectedTileId(corners.parking.id)}
        />
      </View>
      <View style={[styles.corner, styles.topRight]}>
        <Tile
          tile={corners.gotojail}
          orientation="corner"
          onPress={() => setSelectedTileId(corners.gotojail.id)}
        />
      </View>

      {/* Rows */}
      <View style={styles.rowBottom}>
        {bottomRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="bottom"
            owner={getOwner(t.id)}
            onPress={() => setSelectedTileId(t.id)}
          />
        ))}
      </View>

      <View style={styles.colLeft}>
        {leftRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="left"
            owner={getOwner(t.id)}
            onPress={() => setSelectedTileId(t.id)}
          />
        ))}
      </View>

      <View style={styles.rowTop}>
        {topRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="top"
            owner={getOwner(t.id)}
            onPress={() => setSelectedTileId(t.id)}
          />
        ))}
      </View>

      <View style={styles.colRight}>
        {rightRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="right"
            owner={getOwner(t.id)}
            onPress={() => setSelectedTileId(t.id)}
          />
        ))}
      </View>

      {/* Tile Info Modal - moved to bottom to ensure z-index priority */}
      <TileInfoModal
        visible={!!selectedTileId}
        tile={selectedTileId ? BOARD.find(t => t.id === selectedTileId) || null : null}
        owner={selectedTileId ? getOwner(selectedTileId) : undefined}
        onClose={() => setSelectedTileId(null)}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  boardContainer: {
    backgroundColor: '#CDE6D0', // Classic board center color
    position: 'relative',
    borderWidth: 2,
    borderColor: '#000',
  },
  center: {
    position: 'absolute',
    left: `${CORNER_SIZE_PCT}%`,
    top: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // Removed zIndex: 20 to allow modal to overlay.
    // Ensure content inside is clickable by managing click events or assuming default zIndex behavior.
    // If buttons become unclickable, we might need to be more careful.
    // But since `TileInfoModal` is a sibling later in DOM, it should be on top.
    // And `center` without z-index is auto (0).
    // `corners` have zIndex: 10. `center` needs to be > 10 to be clickable if they overlap.
    // BUT `TileInfoModal` needs to be > `center`.
    zIndex: 20,
  },
  topButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    zIndex: 20,
  },
  statusPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  playerList: {
    marginBottom: 15,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerColor: {
    width: 12,
    height: 12,
    marginRight: 6,
    borderRadius: 2,
  },
  playerText: {
    fontSize: 14,
  },
  activePlayerText: {
    fontWeight: 'bold',
  },
  gameInfo: {
    marginBottom: 15,
    alignItems: 'center',
    gap: 4,
  },
  currentPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
  },
  tileColor: {
    width: 12,
    height: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  actions: {
    gap: 8,
    width: '100%',
  },
  corner: {
    position: 'absolute',
    width: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    zIndex: 10,
  },
  bottomRight: { bottom: 0, right: 0 },
  bottomLeft: { bottom: 0, left: 0 },
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0 },

  // Rows and Cols
  rowBottom: {
    position: 'absolute',
    bottom: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  rowTop: {
    position: 'absolute',
    top: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  colLeft: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    left: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column', // 11 is at bottom, 19 at top
  },
  colRight: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    right: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column', // 31 at top, 39 at bottom
  },
});
