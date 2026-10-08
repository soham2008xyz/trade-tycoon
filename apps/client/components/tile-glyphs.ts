import type { Tile } from '@trade-tycoon/game-logic';

/**
 * MaterialCommunityIcons names drawn on compact tiles. Kept as a literal union
 * (NO `@expo/vector-icons` import — see "File-extension discipline" in
 * apps/client/AGENTS.md); `Tile.tsx` passes it to the icon's `name` prop, so a
 * name missing from the glyph map fails the type check there.
 */
export type CompactTileGlyph = 'help' | 'treasure-chest' | 'percent' | 'train' | 'flash' | 'water';

// Both utilities share `type: 'utility'`, so they are told apart by id.
const UTILITY_GLYPHS = new Map<string, CompactTileGlyph>([
  ['electric', 'flash'],
  ['water', 'water'],
]);

/**
 * Icon that stands in for the tile name on narrow boards (#318), where edge
 * tiles drop their name text. Streets return null: their colour bar already
 * identifies them. Corners never reach this — they keep their name.
 */
export const getCompactTileGlyph = (tile: Tile): CompactTileGlyph | null => {
  switch (tile.type) {
    case 'chance':
      return 'help';
    case 'community_chest':
      return 'treasure-chest';
    case 'tax':
      return 'percent';
    case 'railroad':
      return 'train';
    case 'utility':
      return UTILITY_GLYPHS.get(tile.id) ?? 'flash';
    default:
      return null;
  }
};
