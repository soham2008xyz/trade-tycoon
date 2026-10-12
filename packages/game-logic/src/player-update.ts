import type { Player } from './types';

/** A copy of `players` with the entry at `index` replaced by `player`. */
export const replacePlayerAt = (players: Player[], index: number, player: Player): Player[] =>
  players.map((p, i) => (i === index ? player : p));
