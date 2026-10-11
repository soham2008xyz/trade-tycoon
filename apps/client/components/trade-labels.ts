/**
 * Wording for the trade proposal columns (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md).
 */

/** Which side of the proposal a column draws: what the initiator gives or asks for. */
export type TradeColumnRole = 'offer' | 'request';

interface TradeColumnCopy {
  /** Column heading. */
  heading: string;
  /** Verb in the card stepper's accessibility labels ("Offer fewer …"). */
  verb: string;
}

const COLUMN_COPY: Readonly<Record<TradeColumnRole, TradeColumnCopy>> = {
  offer: { heading: 'You Offer', verb: 'Offer' },
  request: { heading: 'You Request', verb: 'Request' },
};

export const tradeColumnCopy = (role: TradeColumnRole): TradeColumnCopy => COLUMN_COPY[role];

/** Accessibility label for the stepper button that lowers or raises the card count. */
export const cardStepLabel = (role: TradeColumnRole, direction: 'fewer' | 'more'): string =>
  `${COLUMN_COPY[role].verb} ${direction} Get Out of Jail Free cards`;

/** "GOOJ Cards (1/2)": cards put on the table out of the cards the player holds. */
export const goojCardsLabel = (selected: number, owned: number): string =>
  `GOOJ Cards (${selected}/${owned})`;
