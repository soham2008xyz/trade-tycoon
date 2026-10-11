import { useEffect, useState } from 'react';
import type { TradeRequest } from '@trade-tycoon/game-logic';

interface DisplayedTrade {
  activeTrade?: TradeRequest | null;
  targetPlayerId?: string;
}

/**
 * What the trade modal should draw. While it is open that is the live props;
 * once it closes the parent clears them, so the last open values are returned
 * instead and the native Modal's exit slide keeps showing the trade it is
 * sliding away rather than blanking out mid-animation.
 */
export function useDisplayedTrade(
  visible: boolean,
  activeTrade?: TradeRequest | null,
  targetPlayerId?: string
): DisplayedTrade {
  const [cached, setCached] = useState<DisplayedTrade>({ activeTrade, targetPlayerId });

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- We must synchronously cache the active trade details when the modal is open so that the native Modal exit slide transition continues to render the trade details instead of abruptly blanking out when the parent clears them on close.
      setCached({ activeTrade, targetPlayerId });
    }
  }, [visible, activeTrade, targetPlayerId]);

  return visible ? { activeTrade, targetPlayerId } : cached;
}
