import { BOARD } from './board-data';
import { Player, PropertyGroup, Tile } from './types';

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
