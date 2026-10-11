import { useEffect, useState } from 'react';
import type { TradeOffer, TradeRequest } from '@trade-tycoon/game-logic';
import { emptyOffer } from '../components/trade-draft';

/** The proposal being composed: what the initiator gives and what they ask for. */
export interface TradeDraft {
  offer: TradeOffer;
  request: TradeOffer;
  setOffer: (next: TradeOffer) => void;
  setRequest: (next: TradeOffer) => void;
}

/**
 * Holds the draft for the trade modal and clears it each time the modal opens
 * fresh (visible with no trade in flight), so a new proposal never starts from
 * the previous one's sliders and checkboxes.
 */
export function useTradeDraft(visible: boolean, activeTrade?: TradeRequest | null): TradeDraft {
  const [offer, setOffer] = useState<TradeOffer>(emptyOffer);
  const [request, setRequest] = useState<TradeOffer>(emptyOffer);

  useEffect(() => {
    if (visible && !activeTrade) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- We must reset the proposal input state synchronously when opening the modal fresh so that the input sliders, properties list, and cash values are initialized to zero instead of carrying over values from the previous proposal.
      setOffer(emptyOffer());
      setRequest(emptyOffer());
    }
  }, [visible, activeTrade]);

  return { offer, request, setOffer, setRequest };
}
