import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { AuctionState, Player, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { shouldShowAuctionControls } from './multiplayer-gating';

export { shouldShowAuctionControls };

interface Props {
  visible: boolean;
  auction: AuctionState | null;
  players: Player[];
  onBid: (playerId: string, amount: number) => void;
  onConcede: (playerId: string) => void;
  /**
   * When true, only the row whose `playerId === myPlayerId` shows bid / fold
   * controls — every client only renders buttons for their own player. The
   * other participants are still listed (so you can see who's still in and
   * who's high bidder), just without buttons.
   *
   * When false (default — used by local hotseat play), every participant's
   * row renders controls; each row's buttons are then enabled or disabled by
   * the existing `isTurn`/`isHighestBidder` checks. The hotseat user keeps
   * the device and acts on whichever row is currently active.
   */
  isMultiplayer?: boolean;
  /**
   * The local user's player id. Only meaningful when `isMultiplayer` is
   * true. Ignored otherwise.
   */
  myPlayerId?: string;
}

// `shouldShowAuctionControls` lives in `./multiplayer-gating` so it can be
// unit-tested in a plain Node vitest environment without React Native. We
// re-export it from this module so existing imports keep working.

/**
 * The auction modal cannot be dismissed by the user — visibility is owned by
 * `state.phase === 'auction'` and only resolves when bidding ends. We still
 * have to satisfy `FullScreenModalShell`'s required `onClose` prop, so this
 * named no-op stands in (also avoids `@typescript-eslint/no-empty-function`).
 */
function noopClose(): void {
  /* auction is controlled by reducer state — no user-driven close */
}

interface ParticipantRowProps {
  player: Player;
  isTurn: boolean;
  isHighestBidder: boolean;
  showControls: boolean;
  currentBid: number;
  increments: readonly number[];
  onBid: (playerId: string, amount: number) => void;
  onConcede: (playerId: string) => void;
}

/**
 * One row of the auction participants list. Renders the player's name and
 * color, and (when `showControls` is true) the bid-increment buttons plus
 * Fold. Extracted so the parent's `.map()` callback stays trivial.
 */
const ParticipantRow: React.FC<ParticipantRowProps> = ({
  player,
  isTurn,
  isHighestBidder,
  showControls,
  currentBid,
  increments,
  onBid,
  onConcede,
}) => (
  <View style={[styles.playerRow, isTurn ? styles.activePlayerRow : styles.inactivePlayerRow]}>
    <View style={styles.playerInfo}>
      <View style={[styles.playerColor, { backgroundColor: player.color }]} />
      <Text style={[styles.playerName, isTurn && styles.activePlayerName]}>
        {player.name} (${player.money}) {isTurn && ' (Bidding)'}
      </Text>
    </View>
    {showControls && (
      <View style={styles.controls}>
        <View style={styles.bidButtons}>
          {increments.map((inc) => {
            const bidAmount = currentBid + inc;
            return (
              <View key={inc} style={styles.buttonWrapper}>
                <IconButton
                  title={`+${inc}`}
                  icon="arrow-up-bold"
                  onPress={() => onBid(player.id, bidAmount)}
                  disabled={player.money < bidAmount || !isTurn}
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
            onPress={() => onConcede(player.id)}
            color="#d9534f"
            disabled={!isTurn || isHighestBidder}
            size="small"
          />
        </View>
      </View>
    )}
  </View>
);

export const AuctionModal: React.FC<Props> = ({
  visible,
  auction,
  players,
  onBid,
  onConcede,
  isMultiplayer = false,
  myPlayerId,
}) => {
  if (!auction) return null;

  const property = BOARD.find((t) => t.id === auction.propertyId);
  const highestBidder = players.find((p) => p.id === auction.highestBidderId);

  // Helper to get next valid bid amount (e.g. current + 10)
  // Or maybe we allow custom amount? For simplicity, let's offer +1, +10, +50, +100
  const increments = [1, 10, 50, 100];

  return (
    <FullScreenModalShell visible={visible} onClose={noopClose} title="Auction" showClose={false}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
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
              return (
                <ParticipantRow
                  key={playerId}
                  player={player}
                  isTurn={index === auction.currentBidderIndex}
                  isHighestBidder={auction.highestBidderId === playerId}
                  showControls={shouldShowAuctionControls(playerId, isMultiplayer, myPlayerId)}
                  currentBid={auction.currentBid}
                  increments={increments}
                  onBid={onBid}
                  onConcede={onConcede}
                />
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Last player remaining wins the auction!</Text>
          </View>
        </View>
      </View>
    </FullScreenModalShell>
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
