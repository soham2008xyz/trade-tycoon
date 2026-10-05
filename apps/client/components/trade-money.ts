/**
 * Pure mapping between a trade money slider and dollar amounts (NO React — see
 * "File-extension discipline" in apps/client/AGENTS.md).
 *
 * The slider counts steps of `MONEY_STEP`, so offers snap to round amounts.
 * The last step is the player's exact cash, so a balance that is not a
 * multiple of the step (say $1,337) can still be offered or requested in full.
 */

export const MONEY_STEP = 10;

/** Number of slider steps for a player holding `max` dollars. */
export function moneySliderMax(max: number): number {
  return Math.ceil(Math.max(0, max) / MONEY_STEP);
}

/** Dollar amount for a slider position, never above `max`. */
export function moneyFromSlider(position: number, max: number): number {
  return Math.min(Math.max(0, max), Math.round(position) * MONEY_STEP);
}

/** Slider position for a dollar amount; the cash balance maps to the last step. */
export function sliderFromMoney(money: number, max: number): number {
  return money >= max ? moneySliderMax(max) : Math.round(money / MONEY_STEP);
}
