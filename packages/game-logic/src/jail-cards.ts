import type { Card } from './cards';
import type { JailCardDeck, JailCardHolders, Player } from './types';

/** Deck order is also the order cards are attributed, moved and returned in. */
export const JAIL_CARD_DECKS: readonly JailCardDeck[] = ['chance', 'communityChest'];

export const emptyJailCardHolders = (): JailCardHolders => ({ chance: null, communityChest: null });

// Holders are read and written through these two helpers rather than
// `holders[deck]`: a variable-key property access is flagged by the
// generic-object-injection lint rule, and with only two decks the explicit
// property names cost nothing.
export const holderOf = (holders: JailCardHolders, deck: JailCardDeck): string | null =>
  deck === 'chance' ? holders.chance : holders.communityChest;

const withHolder = (
  holders: JailCardHolders,
  deck: JailCardDeck,
  holder: string | null
): JailCardHolders =>
  deck === 'chance' ? { ...holders, chance: holder } : { ...holders, communityChest: holder };

const isJailCard = (card: Card): boolean => card.action.type === 'GET_OUT_OF_JAIL';

/** The decks whose jail card `playerId` holds, in deck order. */
export const jailDecksHeldBy = (holders: JailCardHolders, playerId: string): JailCardDeck[] =>
  JAIL_CARD_DECKS.filter((deck) => holderOf(holders, deck) === playerId);

/**
 * The current holders, reconciled with each player's `getOutOfJailCards` count.
 * The count is authoritative for *how many* cards a player has; the stored
 * holders only say *which decks* they came from. They disagree for state that
 * predates `jailCardHolders` (counts only) and for fixtures that set a count
 * directly, so:
 * - a stored holder is kept only while that player's count still covers it;
 * - any counted card without a deck is attributed to the first free deck.
 * Cards beyond the number of decks (reachable only through the old duplicate-draw
 * bug) get no deck and simply stay counted.
 */
export const resolveJailCardHolders = (
  players: readonly Player[],
  stored?: JailCardHolders
): JailCardHolders => {
  // Cards each player has that are not yet attributed to a deck.
  const unassigned = new Map(players.map((p) => [p.id, p.getOutOfJailCards || 0]));
  const claim = (playerId: string | null | undefined): playerId is string => {
    const left = playerId ? (unassigned.get(playerId) ?? 0) : 0;
    if (!playerId || left <= 0) return false;
    unassigned.set(playerId, left - 1);
    return true;
  };

  // Stored holders first, so a player's real deck is not taken by an earlier player's guess.
  const kept = JAIL_CARD_DECKS.map((deck) => {
    const holder = stored ? holderOf(stored, deck) : null;
    return claim(holder) ? holder : null;
  });
  const [chance, communityChest] = kept.map(
    (holder) => holder ?? players.find((p) => claim(p.id))?.id ?? null
  );
  return { chance, communityChest };
};

/**
 * The cards a deck can deal. While its jail card is held it is out of the deck,
 * so it is left out of the pool — one rng value still picks one card, which keeps
 * the number of rng calls per draw unchanged.
 */
export const drawableCards = (deck: readonly Card[], jailCardHeld: boolean): readonly Card[] =>
  jailCardHeld ? deck.filter((card) => !isJailCard(card)) : deck;

/**
 * Moves up to `count` of `fromId`'s jail cards to `toId`; `toId` null returns
 * them to their decks. A player's counted cards beyond their decks (see
 * `resolveJailCardHolders`) have no deck to move.
 */
export const moveJailCards = (
  holders: JailCardHolders,
  fromId: string,
  toId: string | null,
  count: number
): JailCardHolders => {
  return jailDecksHeldBy(holders, fromId)
    .slice(0, count)
    .reduce((next, deck) => withHolder(next, deck, toId), holders);
};

/**
 * A trade's card exchange: `aCount` of A's cards go to B while `bCount` of B's go
 * to A. Both sets are chosen from the holders *before* either moves, so a card
 * just handed over is never handed straight back.
 */
export const swapJailCards = (
  holders: JailCardHolders,
  aId: string,
  aCount: number,
  bId: string,
  bCount: number
): JailCardHolders => {
  const fromA = jailDecksHeldBy(holders, aId).slice(0, aCount);
  const fromB = jailDecksHeldBy(holders, bId).slice(0, bCount);
  const toB = fromA.reduce((next, deck) => withHolder(next, deck, bId), holders);
  return fromB.reduce((next, deck) => withHolder(next, deck, aId), toB);
};
