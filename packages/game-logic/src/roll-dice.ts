import type { GameState, JailCardDeck, JailCardHolders, Player, Tile } from './types';
import type { ActionOf, GameReducerResult, Rng } from './reducer-types';
import { BOARD } from './board-data';
import { type Card, processCardEffect } from './cards';
import { CHANCE_CARDS } from './chance-cards';
import { COMMUNITY_CHEST_CARDS } from './community-chest-cards';
import { chargePlayer, collectFromOthers, settleDebt } from './debt';
import { ownsCompleteGroup } from './helpers';
import { drawableCards, holderOf, resolveJailCardHolders, withHolder } from './jail-cards';
import { replacePlayerAt } from './player-update';

interface Roll {
  die1: number;
  die2: number;
  isDouble: boolean;
}

/** What stays fixed while one roll is resolved, step by step. */
interface RollSeat {
  playerIndex: number;
  roll: Roll;
  rng: Rng;
}

/** The roll's outcome so far; each step takes a draft and returns the next one. */
interface RollDraft {
  players: Player[];
  /** The roller, kept in sync with `players[seat.playerIndex]`. */
  player: Player;
  /** The tile the roller is standing on now (a card may have moved them on). */
  tile: Tile;
  doublesCount: number;
  toast?: string;
  /** Only changes when a Get Out of Jail Free card is drawn. */
  jailCardHolders?: JailCardHolders;
  /** Names the tile the dice reached, before any card moves the player on. */
  rollLog: string;
}

interface DeckSpec {
  deck: JailCardDeck;
  cards: readonly Card[];
  label: string;
}

const CHANCE_DECK: DeckSpec = { deck: 'chance', cards: CHANCE_CARDS, label: 'Chance' };
const COMMUNITY_CHEST_DECK: DeckSpec = {
  deck: 'communityChest',
  cards: COMMUNITY_CHEST_CARDS,
  label: 'Community Chest',
};

/** Log text for a roll, e.g. `Rolled 4 + 4 (doubles)`. */
const describeRoll = (die1: number, die2: number): string =>
  `Rolled ${die1} + ${die2}${die1 === die2 ? ' (doubles)' : ''}`;

const appendToast = (toast: string | undefined, message: string): string =>
  toast ? `${toast} ${message}` : message;

/**
 * Deals one card from `deck`. A held Get Out of Jail Free card is out of the
 * deck, so it is excluded from the pool (still exactly one rng call per draw).
 * Returns the reconciled holders for the caller to extend if the card drawn is
 * the jail card.
 */
const drawFromDeck = (
  deck: JailCardDeck,
  cards: readonly Card[],
  players: readonly Player[],
  stored: JailCardHolders | undefined,
  rng: Rng
): { card: Card; holders: JailCardHolders } => {
  const holders = resolveJailCardHolders(players, stored);
  const pool = drawableCards(cards, holderOf(holders, deck) !== null);
  return { card: pool[Math.floor(rng() * pool.length)], holders };
};

/**
 * Ends the roll where it stands (speeding, or a failed jail attempt): the
 * roller does not move, the turn goes to the action phase with no extra roll.
 */
const endRollEarly = (
  state: GameState,
  seat: RollSeat,
  player: Player,
  toastMessage: string
): GameState => ({
  ...state,
  dice: [seat.roll.die1, seat.roll.die2],
  doublesCount: 0,
  players: replacePlayerAt(state.players, seat.playerIndex, player),
  phase: 'action',
  errorMessage: undefined,
  toastMessage,
  logs: [
    ...state.logs,
    `[${player.name}] ${describeRoll(seat.roll.die1, seat.roll.die2)}.`,
    `[${player.name}] ${toastMessage}`,
  ],
});

type JailRoll =
  | { stays: true; player: Player; toast: string }
  | { stays: false; player: Player; doublesReset: boolean; toast?: string };

/** What a roll does to a player's jail time: they walk free, or they stay put. */
const resolveJailRoll = (player: Player, isDouble: boolean): JailRoll => {
  if (!player.isInJail) return { stays: false, player, doublesReset: false };
  if (isDouble) {
    return {
      stays: false,
      player: { ...player, isInJail: false, jailTurns: 0 },
      // No extra turn after escaping.
      doublesReset: true,
      toast: 'Rolled doubles! You are free from Jail.',
    };
  }
  const turns = player.jailTurns + 1;
  if (turns >= 3) {
    return {
      stays: false,
      player: { ...player, isInJail: false, jailTurns: 0, money: player.money - 50 },
      doublesReset: true,
      toast: 'Paid $50 fine after 3 turns in Jail.',
    };
  }
  return {
    stays: true,
    player: { ...player, jailTurns: turns },
    toast: `No doubles — still in Jail. Attempt ${turns}/3 failed.${turns === 2 ? ' Next non-doubles roll: pay $50 and move.' : ''}`,
  };
};

/** Moves the roller by the dice, collecting $200 for passing GO. */
const moveByDice = (
  state: GameState,
  seat: RollSeat,
  player: Player,
  doublesCount: number,
  toast: string | undefined
): RollDraft => {
  const { die1, die2 } = seat.roll;
  const position = (player.position + die1 + die2) % 40;
  const tile = BOARD[position];
  const passedGo = position < player.position;
  const moved = { ...player, position, money: player.money + (passedGo ? 200 : 0) };
  return {
    // Update immediately so card logic works on current state
    players: replacePlayerAt(state.players, seat.playerIndex, moved),
    player: moved,
    tile,
    doublesCount,
    toast: passedGo ? appendToast(toast, 'Passed GO! Collected $200.') : toast,
    jailCardHolders: state.jailCardHolders,
    rollLog: `[${player.name}] ${describeRoll(die1, die2)} and moved to ${tile.name}.`,
  };
};

/**
 * Draws and applies a card when the roller is standing on `deck`'s tile type.
 * A Chance card can move the player onto Community Chest, so the second draw
 * must see the first.
 */
const drawCard = (draft: RollDraft, seat: RollSeat, spec: DeckSpec): RollDraft => {
  const { card, holders } = drawFromDeck(
    spec.deck,
    spec.cards,
    draft.players,
    draft.jailCardHolders,
    seat.rng
  );
  const { player: afterCard, sentToJail } = processCardEffect(settleDebt(draft.player), card);
  let player = afterCard;
  let players = draft.players;
  if (card.action.type === 'COLLECT_FROM_ALL') {
    const collected = collectFromOthers(players, player.id, card.action.amount);
    players = collected.players;
    player = { ...player, money: player.money + collected.total };
  }
  return {
    ...draft,
    players: replacePlayerAt(players, seat.playerIndex, player),
    player,
    // The card may have moved the player; rent and taxes follow the new tile.
    tile: BOARD[player.position],
    // End turn if sent to jail.
    doublesCount: sentToJail ? 0 : draft.doublesCount,
    // Card texts are bare phrases with no trailing punctuation; add the full
    // stop so a following rent/tax sentence doesn't run into the card text.
    toast: appendToast(draft.toast, `${spec.label}: ${card.text}.`),
    jailCardHolders:
      card.action.type === 'GET_OUT_OF_JAIL'
        ? withHolder(holders, spec.deck, player.id)
        : draft.jailCardHolders,
  };
};

const goToJailTile = (draft: RollDraft, seat: RollSeat): RollDraft => {
  if (draft.tile.type !== 'go_to_jail') return draft;
  const player = { ...draft.player, position: 10, isInJail: true, jailTurns: 0 };
  return {
    ...draft,
    players: replacePlayerAt(draft.players, seat.playerIndex, player),
    player,
    tile: BOARD[10], // the Jail tile (no rent on Jail)
    doublesCount: 0, // End turn
    toast: 'Go to Jail!',
  };
};

const payTax = (draft: RollDraft, seat: RollSeat): RollDraft => {
  if (draft.tile.type !== 'tax') return draft;
  const taxAmount = draft.tile.price ?? 0;
  const player = chargePlayer(draft.player, taxAmount);
  return {
    ...draft,
    players: replacePlayerAt(draft.players, seat.playerIndex, player),
    player,
    toast: appendToast(draft.toast, `Paid $${taxAmount} in Tax.`),
  };
};

const ownedInGroup = (owner: Player, group: string): number =>
  BOARD.filter((t) => t.group === group && owner.properties.includes(t.id)).length;

const streetRent = (tile: Tile, owner: Player): number => {
  const houseCount = owner.houses[tile.id] || 0;
  if (houseCount === 0 && tile.group && ownsCompleteGroup(owner, tile.group)) {
    // Double rent for unimproved complete set
    return (tile.rent ? tile.rent[0] : 0) * 2;
  }
  return tile.rent ? tile.rent[houseCount] : 0;
};

/** The rent `owner` is due for `tile`, ignoring any mortgage. */
const rentDue = (tile: Tile, owner: Player, diceTotal: number): number => {
  if (tile.group === 'railroad') {
    // Rent is 25, 50, 100, 200 based on count (index 0-3)
    const rentIndex = Math.max(0, ownedInGroup(owner, 'railroad') - 1);
    return tile.rent ? tile.rent[rentIndex] : 25;
  }
  if (tile.group === 'utility') {
    return diceTotal * (ownedInGroup(owner, 'utility') === 2 ? 10 : 4);
  }
  if (tile.type === 'street') return streetRent(tile, owner);
  return tile.rent ? tile.rent[0] : 0;
};

const payRent = (draft: RollDraft, seat: RollSeat): RollDraft => {
  const { tile, player } = draft;
  // Don't pay rent if sent to jail
  if (!tile.price || player.isInJail) return draft;
  const ownerIndex = draft.players.findIndex(
    (p) => p.properties.includes(tile.id) && p.id !== player.id
  );
  if (ownerIndex === -1) return draft;

  const owner = draft.players[ownerIndex];
  const isMortgaged = owner.mortgaged.includes(tile.id);
  const rent = isMortgaged ? 0 : rentDue(tile, owner, seat.roll.die1 + seat.roll.die2);
  // Rent is charged (and the owner credited) in full even if the payer is short;
  // the payer then owes the owner, who inherits their assets if they go
  // bankrupt (see transferAssets).
  const payer = chargePlayer(player, rent, owner.id);
  const players = replacePlayerAt(draft.players, seat.playerIndex, payer);
  const message = isMortgaged
    ? `No rent due: ${tile.name} is mortgaged by ${owner.name}.`
    : `Paid $${rent} rent to ${owner.name}.`;
  return {
    ...draft,
    players: replacePlayerAt(players, ownerIndex, { ...owner, money: owner.money + rent }),
    player: payer,
    toast: appendToast(draft.toast, message),
  };
};

const finishRoll = (state: GameState, seat: RollSeat, draft: RollDraft): GameState => ({
  ...state,
  dice: [seat.roll.die1, seat.roll.die2],
  doublesCount: draft.doublesCount,
  players: draft.players,
  ...(draft.jailCardHolders !== state.jailCardHolders && {
    jailCardHolders: draft.jailCardHolders,
  }),
  phase: 'action', // Move to action phase
  auctionedPropertyId: undefined, // new landing, new auction chance
  errorMessage: undefined,
  toastMessage: draft.toast,
  logs: draft.toast
    ? [...state.logs, draft.rollLog, `[${draft.player.name}] ${draft.toast}`]
    : [...state.logs, draft.rollLog],
});

/** A roll needs the player's turn, in the roll phase or in the action phase after doubles. */
const canRoll = (state: GameState, playerId: string): boolean =>
  state.currentPlayerId === playerId &&
  (state.phase === 'roll' || (state.phase === 'action' && state.doublesCount > 0));

/** The dice for this roll: the action's forced values (tests, local play) or rng. */
const throwDice = (action: ActionOf<'ROLL_DICE'>, rng: Rng): Roll => {
  const die1 = action.die1 ?? Math.floor(rng() * 6) + 1;
  const die2 = action.die2 ?? Math.floor(rng() * 6) + 1;
  return { die1, die2, isDouble: die1 === die2 };
};

export const reduceRollDice = (
  state: GameState,
  action: ActionOf<'ROLL_DICE'>,
  rng: Rng
): GameReducerResult => {
  if (!canRoll(state, action.playerId)) return state;

  const roll = throwDice(action, rng);
  const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
  const player = state.players[playerIndex];
  const seat = { playerIndex, roll, rng };
  const doublesCount = roll.isDouble ? state.doublesCount + 1 : 0;

  if (doublesCount >= 3) {
    const jailed = { ...player, position: 10, isInJail: true, jailTurns: 0 };
    return endRollEarly(state, seat, jailed, 'Speeding! 3 doubles in a row. Go directly to Jail.');
  }

  const jail = resolveJailRoll(player, roll.isDouble);
  if (jail.stays) return endRollEarly(state, seat, jail.player, jail.toast);

  let draft = moveByDice(
    state,
    seat,
    jail.player,
    jail.doublesReset ? 0 : doublesCount,
    jail.toast
  );
  if (draft.tile.type === 'chance') draft = drawCard(draft, seat, CHANCE_DECK);
  if (draft.tile.type === 'community_chest') draft = drawCard(draft, seat, COMMUNITY_CHEST_DECK);
  draft = payRent(payTax(goToJailTile(draft, seat), seat), seat);
  return finishRoll(state, seat, draft);
};
