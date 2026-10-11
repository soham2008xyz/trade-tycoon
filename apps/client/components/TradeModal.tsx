import React from 'react';
import { View } from 'react-native';
import { FullScreenModalShell } from './ui/FullScreenModalShell';
import { Player, TradeOffer, TradeRequest } from '@trade-tycoon/game-logic';
import { canAcceptTrade, canCancelTrade } from './multiplayer-gating';
import { useGameLayout } from '../hooks/useGameLayout';
import { useDisplayedTrade } from '../hooks/useDisplayedTrade';
import { useTradeDraft } from '../hooks/useTradeDraft';
import { useTheme } from '../hooks/useTheme';
import { ActiveTradeView } from './trade/ActiveTradeView';
import { ProposeTradeView } from './trade/ProposeTradeView';
import { createTradeStyles } from './trade/trade-styles';

export { canAcceptTrade, canCancelTrade };

interface Props {
  visible: boolean;
  players: Player[];
  currentPlayerId: string;
  targetPlayerId?: string; // Who we are proposing to
  activeTrade?: TradeRequest | null; // Existing trade
  onPropose: (targetPlayerId: string, offer: TradeOffer, request: TradeOffer) => void;
  onAccept: (tradeId: string) => void;
  onReject: (tradeId: string) => void;
  onCancel: (tradeId: string) => void;
  onClose: () => void;
  /** Toasts to draw above the modal while it is open (see `FullScreenModalShell`). */
  overlay?: React.ReactNode;
  /**
   * In online multiplayer the modal renders on every client involved in the
   * trade, so each client must only see the buttons it can actually act on:
   * the target sees Accept/Reject, the initiator sees Cancel. In local
   * hotseat play (default `false`) the user passes the device between
   * players, so all three buttons render and the user clicks whichever one
   * the active player is supposed to use.
   */
  isMultiplayer?: boolean;
}

// `canAcceptTrade` and `canCancelTrade` live in `./multiplayer-gating` so
// they can be unit-tested in a plain Node vitest environment without React
// Native. They are re-exported above so existing imports keep working.

export const TradeModal: React.FC<Props> = (props) => {
  // Destructured in the body, not the signature, so the component's own
  // parameter list stays one `props` object. The twelve props are the modal's
  // public API; the pieces below take only the few each one needs.
  const { visible, players, currentPlayerId, targetPlayerId, activeTrade, overlay, onClose } =
    props;
  const { onPropose, onAccept, onReject, onCancel, isMultiplayer = false } = props;
  const styles = createTradeStyles(useTheme());
  // On phone the shell already draws the "Trade" title + close button and
  // fills the screen, so the card-on-grey-backdrop chrome (own ✕, redundant
  // Cancel, "Trade Proposal" heading) would duplicate it. Wide layouts get a
  // bare transparent Modal from the shell, so there the card keeps its chrome.
  const isPhone = useGameLayout() === 'phone';
  const draft = useTradeDraft(visible, activeTrade);
  const shown = useDisplayedTrade(visible, activeTrade, targetPlayerId);

  const initiator = players.find((p) => p.id === currentPlayerId);
  const target = players.find((p) => p.id === shown.targetPlayerId);

  const renderContent = () => {
    if (shown.activeTrade) {
      return (
        <ActiveTradeView
          trade={shown.activeTrade}
          players={players}
          currentPlayerId={currentPlayerId}
          isMultiplayer={isMultiplayer}
          isPhone={isPhone}
          onAccept={onAccept}
          onReject={onReject}
          onCancel={onCancel}
        />
      );
    }
    if (initiator && target) {
      return (
        <ProposeTradeView
          initiator={initiator}
          target={target}
          draft={draft}
          isPhone={isPhone}
          onPropose={onPropose}
          onClose={onClose}
        />
      );
    }
    return null;
  };

  return (
    <FullScreenModalShell visible={visible} onClose={onClose} title="Trade" overlay={overlay}>
      <View style={isPhone ? styles.phoneOverlay : styles.modalOverlay}>{renderContent()}</View>
    </FullScreenModalShell>
  );
};
