import React from 'react';
import { IconButton } from '../ui/IconButton';
import type { StatusPanelButtons } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';
import { useTheme } from '../../hooks/useTheme';

interface PeekButtonsProps {
  panel: StatusPanelProps;
  buttons: StatusPanelButtons;
}

/** The roll-phase buttons: roll, the two ways out of jail, and bankruptcy. */
export const RollPhaseButtons: React.FC<PeekButtonsProps> = ({ panel, buttons }) => {
  const theme = useTheme();
  return (
    <>
      {buttons.roll.visible && (
        <IconButton title="Roll Dice" icon="dice-5" onPress={panel.onRoll} />
      )}
      {buttons.payFine.visible && (
        <IconButton
          title="Pay Fine ($50)"
          icon="cash-remove"
          onPress={panel.onPayFine}
          disabled={!buttons.payFine.enabled}
          color={theme.danger}
        />
      )}
      {buttons.useGOOJCard.visible && (
        <IconButton
          title={`Use Card (${buttons.useGOOJCard.count})`}
          icon="card-account-details"
          onPress={panel.onUseGOOJCard}
          color={theme.info}
        />
      )}
      {buttons.declareBankruptcy.visible && (
        <IconButton
          title="Declare Bankruptcy"
          icon="alert-circle"
          onPress={panel.onDeclareBankruptcy}
          color={theme.neutralButton}
        />
      )}
    </>
  );
};

/** The action-phase buttons: buy or auction, manage, roll again and end turn. */
export const ActionPhaseButtons: React.FC<PeekButtonsProps> = ({ panel, buttons }) => {
  const theme = useTheme();
  return (
    <>
      {buttons.buy.visible && (
        <IconButton title={`Buy ($${buttons.buy.price})`} icon="cart" onPress={panel.onBuy} />
      )}
      {buttons.auction.visible && (
        <IconButton
          title="Auction"
          icon="gavel"
          onPress={panel.onDeclineBuy}
          color={theme.warning}
        />
      )}
      {buttons.manage.visible && (
        <IconButton
          title="Manage"
          icon="city"
          onPress={panel.onOpenPropertyManager}
          color={theme.brand}
        />
      )}
      {buttons.rollAgain.visible && (
        <IconButton
          title="Roll Again"
          icon="dice-multiple"
          onPress={panel.onRollAgain}
          color={theme.warning}
        />
      )}
      {buttons.endTurn.visible && (
        <IconButton title="End Turn" icon="check" onPress={panel.onEndTurn} color={theme.danger} />
      )}
    </>
  );
};
