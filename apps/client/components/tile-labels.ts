import type { Tile } from '@trade-tycoon/game-logic';

/** A street holds up to 4 houses; 5 is a hotel (see building-labels.ts). */
const HOTEL_COUNT = 5;

const OWNABLE_TYPES: ReadonlySet<Tile['type']> = new Set(['street', 'railroad', 'utility']);

interface TileLabelInput {
  tile: Tile;
  /** Name of the owning player, when the tile is owned. */
  ownerName?: string;
  houseCount?: number;
  isMortgaged?: boolean;
}

/**
 * Screen-reader sentence for a board tile (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md).
 *
 * Sighted players read owner from a colour dot, buildings from small boxes and
 * mortgage from a striped overlay, and on narrow boards the tile name is not
 * drawn at all. None of that reaches VoiceOver, so the label spells it out.
 * Only streets, railroads and utilities can be owned. Tax tiles also carry a
 * `price` (the amount due) that is drawn on the tile, so it is read out, but
 * they never get ownership wording: the type decides that, not the price.
 */
export const getTileAccessibilityLabel = ({
  tile,
  ownerName,
  houseCount = 0,
  isMortgaged = false,
}: TileLabelInput): string => {
  const parts = [tile.name];
  if (tile.price !== undefined) parts.push(`$${tile.price}`);
  if (OWNABLE_TYPES.has(tile.type)) parts.push(ownerName ? `owned by ${ownerName}` : 'unowned');
  if (houseCount === HOTEL_COUNT) {
    parts.push('hotel');
  } else if (houseCount > 0) {
    parts.push(`${houseCount} ${houseCount === 1 ? 'house' : 'houses'}`);
  }
  if (isMortgaged) parts.push('mortgaged');
  return parts.join(', ');
};

/**
 * Owner text drawn on a board tile beside the owner's marker (#360), so
 * ownership does not rest on the marker's colour and shape alone. Normal tiles
 * show the full name (the caller truncates it to one line with an ellipsis);
 * compact tiles (see `Tile`'s `compact` prop) are ~24px wide, where even a short
 * name would not fit, so they show the initial. Whitespace-only names have no
 * label. Initials are taken by code point, not UTF-16 unit, so an emoji or other
 * astral first character is not split in half.
 */
export const getOwnerTileLabel = (ownerName: string, compact: boolean): string | null => {
  const name = ownerName.trim();
  if (!name) return null;
  if (!compact) return name;
  const [initial] = Array.from(name);
  return initial.toUpperCase();
};
