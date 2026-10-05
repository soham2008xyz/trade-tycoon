/**
 * Dollar display for player cash (NO React — see "File-extension discipline"
 * in apps/client/AGENTS.md).
 *
 * A player can end up below zero before they sell or mortgage, and a template
 * like `$${money}` renders that as `$-100`. The sign belongs before the
 * currency symbol: `-$100`.
 */
export const formatMoney = (amount: number): string =>
  amount < 0 ? `-$${Math.abs(amount)}` : `$${amount}`;
