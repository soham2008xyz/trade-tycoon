/**
 * Button labels for building on a street (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md).
 *
 * A street holds up to 4 houses; the 5th build step is a hotel (stored as
 * `houses === 5`). Both use the same price, but the player sees "Hotel" for
 * that step, so the label must follow the count.
 */
const HOTEL_COUNT = 5;

/** Label for the build button at the street's current house count. */
export const buildLabel = (houses: number, cost: number): string =>
  `Build ${houses === HOTEL_COUNT - 1 ? 'Hotel' : 'House'} ($${cost})`;

/** Label for the sell button at the street's current house count. */
export const sellLabel = (houses: number, refund: number): string =>
  `Sell ${houses === HOTEL_COUNT ? 'Hotel' : 'House'} ($${refund})`;
