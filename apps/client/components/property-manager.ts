/**
 * Pure derivations for the Manage Properties modal (NO React — see
 * "File-extension discipline" in apps/client/AGENTS.md).
 */
import { BOARD, getUnmortgageCost } from '@trade-tycoon/game-logic';
import type { Tile } from '@trade-tycoon/game-logic';

/** Tile types the modal lists; Chance, tax and corner tiles are never owned. */
const MANAGED_TYPES: ReadonlySet<string> = new Set(['street', 'railroad', 'utility']);

/** One color group's owned tiles, as `[group, tiles]`. */
export type OwnedGroup = [group: string, tiles: Tile[]];

/**
 * Groups the player's properties by color, in board order. A tile with no
 * group falls under `'misc'`. Within a group tiles keep the order of
 * `propertyIds`; groups are sorted by their first tile's board index so they
 * appear in the standard order. Ids that are not on the board, or that are not
 * a street, railroad or utility, are skipped.
 *
 * Built on a `Map` rather than a `Record<string, Tile[]>` so static analyzers
 * don't flag the key access as object-injection.
 */
export const groupOwnedProperties = (propertyIds: readonly string[]): OwnedGroup[] => {
  const byGroup = new Map<string, Tile[]>();
  for (const id of propertyIds) {
    const tile = BOARD.find((t) => t.id === id);
    if (!tile || !MANAGED_TYPES.has(tile.type)) continue;
    const group = tile.group || 'misc';
    byGroup.set(group, [...(byGroup.get(group) ?? []), tile]);
  }
  return Array.from(byGroup.entries()).sort(([, a], [, b]) => a[0].index - b[0].index);
};

export interface MortgageButtonInput {
  /** The tile's mortgage value, or 0 for a tile without one. */
  mortgageValue: number;
  isMortgaged: boolean;
  /** Houses on this tile. */
  houses: number;
  /** Whether any tile in the tile's color group has a house. */
  groupHasHouses: boolean;
  /** The owner's cash. */
  money: number;
}

export interface MortgageButtonState {
  /** Which action the button performs; exactly one of the two ever shows. */
  action: 'mortgage' | 'unmortgage';
  label: string;
  disabled: boolean;
}

/**
 * What the single Mortgage/Unmortgage button should say and whether it is
 * enabled. Mortgaging needs a group with no houses (they must be sold
 * first); unmortgaging needs enough cash for the repayment with interest.
 */
export const getMortgageButton = ({
  mortgageValue,
  isMortgaged,
  houses,
  groupHasHouses,
  money,
}: MortgageButtonInput): MortgageButtonState => {
  if (isMortgaged) {
    const cost = getUnmortgageCost(mortgageValue);
    return { action: 'unmortgage', label: `Unmortgage ($${cost})`, disabled: money < cost };
  }
  return {
    action: 'mortgage',
    label: `Mortgage ($${mortgageValue})`,
    disabled: houses > 0 || groupHasHouses,
  };
};
