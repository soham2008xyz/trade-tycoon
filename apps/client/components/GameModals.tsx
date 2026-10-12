import React from 'react';
import type { GameFlows } from '../hooks/useGameFlows';
import type { GameUIProps } from './game-ui-props';
import type { ToastHost } from './toast-host';
import { CustomAlert } from './ui/Alert';
import { AuctionModal } from './AuctionModal';
import { LogModal } from './LogModal';
import { PropertyManager } from './PropertyManager';
import { TileInfoModal } from './TileInfoModal';
import { TradeModal } from './TradeModal';

interface GameModalsProps {
  ui: GameUIProps;
  flows: GameFlows;
  /** The game toasts, handed to whichever modal `flows.toastHost` names. */
  toasts: React.ReactNode;
}

interface AuctionHostProps {
  ui: GameUIProps;
  flows: GameFlows;
  overlay: React.ReactNode;
}

/** The auction modal, wired to bid/fold dispatches and the online presence controls. */
const AuctionHost: React.FC<AuctionHostProps> = ({ ui, flows, overlay }) => {
  const { state, onDispatch, onRemovePlayer } = ui;
  const { isMultiplayer, disconnectedPlayerIds } = flows;
  const { removablePlayerIds } = flows.removal;
  const presence = onRemovePlayer
    ? { disconnectedPlayerIds, removablePlayerIds, onRemovePlayer }
    : undefined;

  return (
    <AuctionModal
      visible={state.phase === 'auction'}
      auction={state.auction || null}
      players={state.players}
      onBid={(playerId, amount) => onDispatch({ type: 'PLACE_BID', playerId, amount })}
      onConcede={(playerId) => onDispatch({ type: 'CONCEDE_AUCTION', playerId })}
      isMultiplayer={isMultiplayer}
      myPlayerId={ui.currentPlayerId}
      presence={presence}
      overlay={overlay}
      timer={state.timer}
    />
  );
};

/** The trade modal, mounted only while the local player can be resolved. */
const TradeHost: React.FC<AuctionHostProps> = ({ ui, flows, overlay }) => {
  const { state, currentPlayerId: myPlayerId } = ui;
  const { trade } = flows;
  if (!trade.mounted) return null;

  return (
    <TradeModal
      visible={trade.visible}
      players={state.players}
      currentPlayerId={myPlayerId}
      targetPlayerId={trade.targetPlayerId}
      activeTrade={state.activeTrade}
      isMultiplayer={flows.isMultiplayer}
      onPropose={trade.onPropose}
      onAccept={trade.onAccept}
      onReject={trade.onReject}
      onCancel={trade.onCancel}
      onClose={trade.onClose}
      overlay={overlay}
    />
  );
};

interface PropertyManagerHostProps {
  flows: GameFlows;
  overlay: React.ReactNode;
}

/**
 * Bound to the local player, not whoever's turn it is — otherwise the panel
 * can end up showing and acting on a different player's assets if the turn
 * changes while it's open.
 */
const PropertyManagerHost: React.FC<PropertyManagerHostProps> = ({ flows, overlay }) => {
  const { myPlayer, manager } = flows;
  if (!myPlayer) return null;

  return (
    <PropertyManager
      visible={manager.visible}
      player={myPlayer}
      onClose={manager.close}
      overlay={overlay}
      onBuild={manager.onBuild}
      onSell={manager.onSell}
      onMortgage={manager.onMortgage}
      onUnmortgage={manager.onUnmortgage}
    />
  );
};

/** Every modal the game screen can open, each drawing the toasts when it is the topmost. */
export const GameModals: React.FC<GameModalsProps> = ({ ui, flows, toasts }) => {
  const { state } = ui;
  const { alert, selectedTile, selectedTileId } = flows;
  const overlayFor = (host: ToastHost) => (flows.toastHost === host ? toasts : null);
  const owner = selectedTileId
    ? state.players.find((p) => p.properties.includes(selectedTileId))
    : undefined;

  return (
    <>
      <LogModal
        visible={flows.logVisible}
        logs={state.logs}
        players={state.players}
        onClose={flows.closeLog}
        overlay={overlayFor('log')}
      />
      <CustomAlert visible={alert.visible} options={alert.options} onClose={alert.closeAlert} />
      <AuctionHost ui={ui} flows={flows} overlay={overlayFor('auction')} />
      <TradeHost ui={ui} flows={flows} overlay={overlayFor('trade')} />
      <PropertyManagerHost flows={flows} overlay={overlayFor('manage')} />
      <TileInfoModal
        visible={!!selectedTileId}
        tile={selectedTile}
        owner={owner}
        onClose={flows.clearSelectedTile}
        overlay={overlayFor('tile')}
      />
    </>
  );
};
