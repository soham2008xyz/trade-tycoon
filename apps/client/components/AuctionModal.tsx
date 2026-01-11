import React from 'react';
import { View, Text, StyleSheet, Modal, Button, ScrollView, SafeAreaView } from 'react-native';
import { AuctionState, Player, BOARD } from '@trade-tycoon/game-logic';

interface Props {
  visible: boolean;
  auction: AuctionState | null;
  players: Player[];
  onBid: (playerId: string, amount: number) => void;
  onConcede: (playerId: string) => void;
}

export const AuctionModal: React.FC<Props> = ({
  visible,
  auction,
  players,
  onBid,
  onConcede,
}) => {
  if (!auction) return null;

  const property = BOARD.find((t) => t.id === auction.propertyId);
  const highestBidder = players.find((p) => p.id === auction.highestBidderId);

  // Helper to get next valid bid amount (e.g. current + 10)
  // Or maybe we allow custom amount? For simplicity, let's offer +1, +10, +50, +100
  const increments = [1, 10, 50, 100];

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Auction for {property?.name}</Text>
          <Text style={styles.currentBid}>
            Current Bid: ${auction.currentBid}
            {highestBidder ? ` by ${highestBidder.name}` : ' (No bids yet)'}
          </Text>
        </View>

        <ScrollView style={styles.participantsList}>
          {auction.participants.map((playerId) => {
            const player = players.find((p) => p.id === playerId);
            if (!player) return null;

            const isHighestBidder = auction.highestBidderId === playerId;
            const canAffordBid = (amount: number) => player.money >= amount;

            return (
              <View key={playerId} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                  <Text style={styles.playerName}>
                    {player.name} (${player.money})
                  </Text>
                </View>

                <View style={styles.controls}>
                  <View style={styles.bidButtons}>
                    {increments.map((inc) => {
                      const bidAmount = auction.currentBid + inc;
                      const disabled = !canAffordBid(bidAmount) || isHighestBidder;
                      return (
                        <View key={inc} style={styles.buttonWrapper}>
                            <Button
                            title={`+${inc}`}
                            onPress={() => onBid(playerId, bidAmount)}
                            disabled={disabled}
                            />
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.foldButton}>
                    <Button
                        title="Fold"
                        onPress={() => onConcede(playerId)}
                        color="red"
                        disabled={isHighestBidder}
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
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  currentBid: {
    fontSize: 18,
    color: '#444',
  },
  participantsList: {
    flex: 1,
    padding: 10,
  },
  playerRow: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
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
      alignSelf: 'flex-start'
  },
  footer: {
      padding: 15,
      alignItems: 'center',
      borderTopWidth: 1,
      borderColor: '#ccc',
      backgroundColor: '#eee'
  },
  footerText: {
      fontStyle: 'italic',
      color: '#666'
  }
});
