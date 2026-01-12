import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { AuctionState, Player, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';

interface Props {
  visible: boolean;
  auction: AuctionState | null;
  players: Player[];
  onBid: (playerId: string, amount: number) => void;
  onConcede: (playerId: string) => void;
  boardSize?: number;
}

export const AuctionModal: React.FC<Props> = ({
  visible,
  auction,
  players,
  onBid,
  onConcede,
  boardSize,
}) => {
  if (!auction) return null;

  const property = BOARD.find((t) => t.id === auction.propertyId);
  const highestBidder = players.find((p) => p.id === auction.highestBidderId);

  // Helper to get next valid bid amount (e.g. current + 10)
  // Or maybe we allow custom amount? For simplicity, let's offer +1, +10, +50, +100
  const increments = [1, 10, 50, 100];

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, boardSize ? { width: boardSize - 40 } : undefined]}>
          <View style={styles.header}>
            <Text style={styles.title}>Auction for {property?.name}</Text>
            <Text style={styles.currentBid}>
              Current Bid: ${auction.currentBid}
              {highestBidder ? ` by ${highestBidder.name}` : ' (No bids yet)'}
            </Text>
          </View>

          <ScrollView style={styles.participantsList}>
            {auction.participants.map((playerId, index) => {
              const player = players.find((p) => p.id === playerId);
              if (!player) return null;

              const isHighestBidder = auction.highestBidderId === playerId;
              const isTurn = index === auction.currentBidderIndex;
              const canAffordBid = (amount: number) => player.money >= amount;

              return (
                <View
                  key={playerId}
                  style={[
                    styles.playerRow,
                    isTurn ? styles.activePlayerRow : styles.inactivePlayerRow,
                  ]}
                >
                  <View style={styles.playerInfo}>
                    <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                    <Text style={[styles.playerName, isTurn && styles.activePlayerName]}>
                      {player.name} (${player.money}) {isTurn && ' (Your Turn)'}
                    </Text>
                  </View>

                  <View style={styles.controls}>
                    <View style={styles.bidButtons}>
                      {increments.map((inc) => {
                        const bidAmount = auction.currentBid + inc;
                        const disabled = !canAffordBid(bidAmount) || !isTurn;
                        // Note: Standard rules don't strictly forbid bidding against yourself, but logic blocks it if not turn.
                        // If I am high bidder, and it's my turn (e.g. everyone else folded?), I win immediately by logic.
                        // But if there are others, it won't be my turn if I am high bidder (unless I outbid myself which is silly).
                        // Actually, if I bid, turn passes. So I can't bid again immediately.

                        return (
                          <View key={inc} style={styles.buttonWrapper}>
                            <IconButton
                              title={`+${inc}`}
                              icon="arrow-up-bold"
                              onPress={() => onBid(playerId, bidAmount)}
                              disabled={disabled}
                              size="small"
                            />
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.foldButton}>
                      <IconButton
                        title="Fold"
                        icon="close-circle"
                        onPress={() => onConcede(playerId)}
                        color="#d9534f"
                        disabled={!isTurn || isHighestBidder}
                        size="small"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Last player remaining wins the auction!</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
    elevation: 5,
    overflow: 'hidden', // Ensure content doesn't spill out of rounded corners
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  currentBid: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
  },
  participantsList: {
    flexGrow: 0, // Important for ScrollView inside centered modal
    padding: 10,
  },
  playerRow: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
    boxShadow: '0px 1px 1.41px rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activePlayerRow: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  inactivePlayerRow: {
    opacity: 0.6,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  activePlayerName: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  controls: {
    gap: 10,
  },
  bidButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 5,
  },
  buttonWrapper: {
    minWidth: 60,
  },
  foldButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#eee',
  },
  footerText: {
    fontStyle: 'italic',
    color: '#666',
  },
});
