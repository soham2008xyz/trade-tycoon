import type { Card } from './cards';
import type { JailCardDeck, JailCardHolders, Player } from './types';

/** Deck order is also the order cards are attributed, moved and returned in. */
export const JAIL_CARD_DECKS: readonly JailCardDeck[] = ['chance', 'communityChest'];

export const emptyJailCardHolders = (): JailCardHolders => ({ chance: null, communityChest: null });

const isJailCard = (card: Card): boolean => card.action.type === 'GET_OUT_OF_JAIL';

/** The decks whose jail card `playerId` holds, in deck order. */
export const jailDecksHeldBy = (holders: JailCardHolders, playerId: string): JailCardDeck[] =>
  JAIL_CARD_DECKS.filter((deck) => holders[deck] === playerId);

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
  const holders = emptyJailCardHolders();
  const owned = new Map(players.map((p) => [p.id, p.getOutOfJailCards || 0]));
  const used = new Map<string, number>();
  const claim = (deck: JailCardDeck, playerId: string) => {
    holders[deck] = playerId;
    used.set(playerId, (used.get(playerId) ?? 0) + 1);
  };

  for (const deck of JAIL_CARD_DECKS) {
    const holder = stored?.[deck];
    if (holder && (owned.get(holder) ?? 0) > (used.get(holder) ?? 0)) claim(deck, holder);
  }
  for (const player of players) {
    for (const deck of JAIL_CARD_DECKS) {
      if (holders[deck] === null && (owned.get(player.id) ?? 0) > (used.get(player.id) ?? 0)) {
        claim(deck, player.id);
      }
    }
  }
  return holders;
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
  const next = { ...holders };
  for (const deck of jailDecksHeldBy(holders, fromId).slice(0, count)) next[deck] = toId;
  return next;
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
  const next = { ...holders };
  for (const deck of jailDecksHeldBy(holders, aId).slice(0, aCount)) next[deck] = bId;
  for (const deck of jailDecksHeldBy(holders, bId).slice(0, bCount)) next[deck] = aId;
  return next;
};
