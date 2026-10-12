import type { GameState, Player } from './types';

export const withoutDebt = (p: Player): Player => {
  const copy = { ...p };
  delete copy.debtOwedTo;
  return copy;
};

/**
 * A player who is solvent has settled any earlier debt (e.g. via GO income
 * earlier in the same roll), so a charge made after that point can only create
 * a fresh one. Call this before applying any charge that is not routed through
 * `chargePlayer`.
 */
export const settleDebt = (p: Player): Player => (p.money >= 0 ? withoutDebt(p) : p);

/**
 * Charges `p` `amount` and, when that leaves them below $0, records who they
 * now owe. `creditorId` is the receiving player for player-to-player payments
 * and `undefined` for the bank. A bank charge never overwrites an existing
 * creditor: a player who already owes someone keeps owing them even if a tax
 * deepens the hole. A later player-to-player payment replaces it (the most
 * recent player creditor inherits).
 */
export const chargePlayer = (p: Player, amount: number, creditorId?: string): Player => {
  const money = p.money - amount;
  const charged = { ...settleDebt(p), money };
  // `amount > 0`: a $0 charge (rent on a mortgaged tile) owes the payee nothing,
  // so it must not make them the creditor of debt that arose elsewhere.
  if (amount > 0 && money < 0 && creditorId) charged.debtOwedTo = creditorId;
  return charged;
};

/**
 * Applies a "collect from every player" card: each other player is charged
 * `amount` (owing the collector if that sinks them) and the collector is owed
 * the total. Returns a new array; the collector's own entry is left as is.
 */
export const collectFromOthers = (
  players: Player[],
  collectorId: string,
  amount: number
): { players: Player[]; total: number } => {
  const others = players.filter((p) => p.id !== collectorId).length;
  return {
    players: players.map((p) => (p.id === collectorId ? p : chargePlayer(p, amount, collectorId))),
    total: amount * others,
  };
};

/**
 * Drops `debtOwedTo` from players who are solvent again or whose creditor is
 * no longer in the game. Runs once on every reducer result (see
 * `reduceGameAction`) so every code path that changes money — selling,
 * mortgaging, trades, auctions — restores the invariant "debtOwedTo is set
 * only while money < 0" without each one knowing about debts. Returns the
 * input untouched (reference-equal) when nothing needs clearing so the
 * "unchanged state means rejected" contract still holds.
 */
export const clearSettledDebts = (state: GameState): GameState => {
  const stale = (p: Player) =>
    p.debtOwedTo !== undefined &&
    (p.money >= 0 || !state.players.some((other) => other.id === p.debtOwedTo));
  if (!state.players.some(stale)) return state;
  return { ...state, players: state.players.map((p) => (stale(p) ? withoutDebt(p) : p)) };
};
