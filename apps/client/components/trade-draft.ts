/**
 * Pure state transitions for the trade proposal being composed (NO React —
 * see "File-extension discipline" in apps/client/AGENTS.md).
 *
 * One `TradeOffer` holds one side of the draft (what the initiator offers, or
 * what they request). Every function returns a new object, so the modal can
 * hand them straight to `setState`.
 */
import type { TradeOffer } from '@trade-tycoon/game-logic';

/** A fresh, empty side. A function (not a constant) so no two sides share an array. */
export const emptyOffer = (): TradeOffer => ({ money: 0, properties: [], getOutOfJailCards: 0 });

/** Sets the cash amount, leaving properties and cards alone. */
export const withMoney = (offer: TradeOffer, money: number): TradeOffer => ({ ...offer, money });

/** Adds `propertyId` to the side, or removes it when it is already there. */
export const toggleProperty = (offer: TradeOffer, propertyId: string): TradeOffer => ({
  ...offer,
  properties: offer.properties.includes(propertyId)
    ? offer.properties.filter((id) => id !== propertyId)
    : [...offer.properties, propertyId],
});

/**
 * Moves the Get Out of Jail Free card count by `delta`, never below 0 and
 * never above the `owned` cards the player actually holds.
 */
export const stepCards = (offer: TradeOffer, delta: number, owned: number): TradeOffer => ({
  ...offer,
  getOutOfJailCards: Math.min(owned, Math.max(0, offer.getOutOfJailCards + delta)),
});
