import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { AuctionState, Player, BOARD } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { DisconnectedBadge } from './ui/DisconnectedBadge';
import { shouldShowAuctionControls } from './multiplayer-gating';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';
import { formatMoney } from './format-money';

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
  /**
   * Online only: who the server hasn't heard from lately and which of them the
   * local user may remove (resolved through `canRemovePlayer` upstream). This
   * modal covers the status panel, so without its own button an auction stuck
   * on an absent bidder could never be unstuck by the host. Omitted in hotseat.
   */
  presence?: {
    disconnectedPlayerIds: readonly string[];
    removablePlayerIds: readonly string[];
    onRemovePlayer: (targetPlayerId: string) => void;
  };
  /** Toasts to draw above the modal while it is open (see `FullScreenModalShell`). */
  overlay?: React.ReactNode;
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
  isDisconnected: boolean;
  canRemove: boolean;
  onRemove: (playerId: string) => void;
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
  isDisconnected,
  canRemove,
  onRemove,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  // Confirmed inline rather than through `CustomAlert`: that is a second
  // `Modal`, and presenting one while this auction `Modal` is up can fail to
  // show on iOS.
  const [confirming, setConfirming] = React.useState(false);

  return (
    <View style={[styles.playerRow, isTurn && styles.activePlayerRow]}>
      {/* Dimmed per element, not per row: a faded Remove button reads as disabled. */}
      <View style={[styles.playerInfo, !isTurn && styles.inactiveDim]}>
        <View style={[styles.playerColor, { backgroundColor: player.color }]} />
        <Text style={[styles.playerName, isTurn && styles.activePlayerName]}>
          {player.name} ({formatMoney(player.money)}) {isTurn && ' (Bidding)'}
        </Text>
        {isDisconnected && (
          <View style={styles.badgeWrapper}>
            <DisconnectedBadge name={player.name} />
          </View>
        )}
      </View>
      {canRemove &&
        (confirming ? (
          <View style={styles.controls}>
            <Text style={styles.confirmText}>
              {`Remove ${player.name} from the game? They won't be able to rejoin. If only one player is left, that player wins.`}
            </Text>
            <View style={styles.bidButtons}>
              <IconButton
                title="Yes, remove"
                icon="account-remove"
                onPress={() => onRemove(player.id)}
                color={theme.danger}
                size="small"
              />
              <IconButton
                title="Cancel"
                onPress={() => setConfirming(false)}
                color={theme.neutralButton}
                size="small"
              />
            </View>
          </View>
        ) : (
          <IconButton
            title={`Remove ${player.name}`}
            icon="account-remove"
            onPress={() => setConfirming(true)}
            color={theme.danger}
            size="small"
          />
        ))}
      {showControls && (
        <View style={[styles.controls, !isTurn && styles.inactiveDim]}>
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
              color={theme.danger}
              disabled={!isTurn || isHighestBidder}
              size="small"
            />
          </View>
        </View>
      )}
    </View>
  );
};

export const AuctionModal: React.FC<Props> = ({
  visible,
  auction,
  players,
  onBid,
  onConcede,
  isMultiplayer = false,
  myPlayerId,
  presence,
  overlay,
}) => {
  const styles = createStyles(useTheme());
  if (!auction) return null;

  const property = BOARD.find((t) => t.id === auction.propertyId);
  const highestBidder = players.find((p) => p.id === auction.highestBidderId);

  // Helper to get next valid bid amount (e.g. current + 10)
  // Or maybe we allow custom amount? For simplicity, let's offer +1, +10, +50, +100
  const increments = [1, 10, 50, 100];

  return (
    <FullScreenModalShell
      visible={visible}
      onClose={noopClose}
      title="Auction"
      showClose={false}
      overlay={overlay}
    >
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
                  isDisconnected={!!presence?.disconnectedPlayerIds.includes(playerId)}
                  canRemove={!!presence?.removablePlayerIds.includes(playerId)}
                  onRemove={(id) => presence?.onRemovePlayer(id)}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.scrim,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '95%',
      maxHeight: '90%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
      elevation: 5,
      overflow: 'hidden', // Ensure content doesn't spill out of rounded corners
    },
    header: {
      padding: 20,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderStrong,
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
      textAlign: 'center',
      color: theme.textPrimary,
    },
    currentBid: {
      fontSize: 18,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    participantsList: {
      flexGrow: 0, // Important for ScrollView inside centered modal
      padding: 10,
    },
    playerRow: {
      backgroundColor: theme.surfaceMuted,
      padding: 15,
      marginBottom: 10,
      borderRadius: 8,
      elevation: 2,
      boxShadow: '0px 1px 1.41px rgba(0,0,0,0.2)',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    activePlayerRow: {
      borderColor: theme.highlight,
      backgroundColor: theme.surfaceSelected,
    },
    inactiveDim: {
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
      borderColor: theme.outline,
    },
    playerName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    activePlayerName: {
      color: theme.highlight,
      fontWeight: 'bold',
    },
    controls: {
      gap: 10,
    },
    badgeWrapper: {
      marginLeft: 10,
    },
    confirmText: {
      fontSize: 15,
      color: theme.textSecondary,
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
      borderColor: theme.borderStrong,
      backgroundColor: theme.border,
    },
    footerText: {
      fontStyle: 'italic',
      color: theme.textSecondary,
    },
  });
