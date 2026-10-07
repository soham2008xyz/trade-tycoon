import { BOARD } from './board-data';
import { Player, PropertyGroup, Tile } from './types';

/**
 * Small, fast, seedable PRNG (Mulberry32) returning a `() => number` in
 * [0, 1), the same shape as `Math.random`. Used by the server so a Redis
 * store CAS retry can re-invoke the reducer mutator and get back the exact
 * same dice roll / card draw instead of silently re-rolling — see
 * `reduceGameAction`'s `rng` parameter.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * The 10% interest on a mortgage, rounded up to a whole dollar. Integer maths
 * on purpose — `Math.ceil(value * 0.1)` can overshoot by $1 for some values
 * because of float error. Charged when lifting a mortgage and when a bankrupt
 * player's mortgaged property is inherited.
 */
export const getMortgageInterest = (mortgageValue: number): number => Math.ceil(mortgageValue / 10);

/**
 * Cost to lift a mortgage: the mortgage value plus 10% interest. The reducer
 * and the Manage UI both call this so the button label can never disagree
 * with the amount charged.
 */
export const getUnmortgageCost = (mortgageValue: number): number =>
  mortgageValue + getMortgageInterest(mortgageValue);

export const getPropertiesInGroup = (group: PropertyGroup): Tile[] => {
  return BOARD.filter((tile) => tile.group === group);
};

export const ownsCompleteGroup = (player: Player, group: PropertyGroup): boolean => {
  const groupTiles = getPropertiesInGroup(group);
  return groupTiles.every((tile) => player.properties.includes(tile.id));
};

export const validateEvenBuild = (player: Player, propertyId: string): boolean => {
  const tile = BOARD.find((t) => t.id === propertyId);
  if (!tile || !tile.group) return false;

  const groupTiles = getPropertiesInGroup(tile.group);
  const currentHouses = player.houses[propertyId] || 0;

  // Rule: Cannot build if any property in the group has fewer houses than current property (before build)
  // Actually, standard rule: "You must build evenly. You cannot build a second house on any property of any color-group until you have built one house on every property of that group."
  // So, difference between min and max houses in group cannot be > 1.
  // If I want to build on property P (current houses H), then all other properties must have at least H houses.

  // Let's check the houses of all properties in the group
  const houseCounts = groupTiles.map((t) => player.houses[t.id] || 0);
  const minHouses = Math.min(...houseCounts);

  // If I am at minHouses, I can build (unless I am already at max 5).
  // If I am > minHouses, I cannot build until others catch up.

  return currentHouses === minHouses;
};

export const validateEvenSell = (player: Player, propertyId: string): boolean => {
  const tile = BOARD.find((t) => t.id === propertyId);
  if (!tile || !tile.group) return false;

  const groupTiles = getPropertiesInGroup(tile.group);
  const currentHouses = player.houses[propertyId] || 0;

  // Rule: "You must sell evenly. You cannot sell a house from a property if any other property in that group has more houses."
  // So if I want to sell from P (houses H), no other property can have > H houses.
  // Or: I must sell from the property with the MAX houses.

  const houseCounts = groupTiles.map((t) => player.houses[t.id] || 0);
  const maxHouses = Math.max(...houseCounts);

  return currentHouses === maxHouses;
};

/**
 * Why `player` can't build on `propertyId` right now, as the user-facing
 * message, or `null` if the build is allowed. Covers only the rules that
 * depend on the player's own holdings; turn, phase and pending-double checks
 * stay in the reducer. The reducer's `BUILD_HOUSE` case and the Manage
 * screen's Build button both call this, so the button can't be enabled for a
 * build the server will reject (#323).
 */
export const getBuildBlocker = (player: Player, propertyId: string): string | null => {
  const tile = BOARD.find((t) => t.id === propertyId);
  if (!tile || !tile.houseCost || !tile.group) return 'Cannot build on this property.';

  if (!player.properties.includes(propertyId)) return 'You do not own this property.';

  if (!ownsCompleteGroup(player, tile.group))
    return 'You must own the complete color group to build.';

  // No mortgaged property in the group (standard Monopoly rule)
  const groupHasMortgage = getPropertiesInGroup(tile.group).some((t) =>
    player.mortgaged.includes(t.id)
  );
  if (groupHasMortgage) return 'Cannot build: a property in this color group is mortgaged.';

  if ((player.houses[propertyId] || 0) >= 5) return 'Max buildings reached.';

  if (player.money < tile.houseCost) return 'Insufficient funds.';

  if (!validateEvenBuild(player, propertyId))
    return 'You must build evenly across the color group.';

  return null;
};
