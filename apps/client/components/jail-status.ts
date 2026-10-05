import type { Player } from '@trade-tycoon/game-logic';

type JailPlayer = Pick<Player, 'isInJail' | 'jailTurns'>;

/** jailTurns counts completed failed rolls, starting at zero on entry. */
export function getJailStatus(player: JailPlayer) {
  if (!player.isInJail) return null;
  return {
    text: `In Jail · ${player.jailTurns}/3 failed rolls`,
    accessibilityLabel: `In Jail. ${player.jailTurns} of 3 failed rolls used.`,
    hint:
      player.jailTurns === 2
        ? 'Next roll: doubles to leave, otherwise pay $50 and move.'
        : 'Roll doubles to leave, pay $50, or use a card. A third failed roll costs $50 and moves you.',
  };
}

/** Tile 10 is a visit only when the authoritative jail flag is false. */
export function getPlayerPositionLabel(
  player: Pick<Player, 'isInJail' | 'position'>,
  tileName: string | undefined
) {
  if (player.isInJail) return 'In Jail';
  if (player.position === 10) return 'Just Visiting';
  return tileName;
}

export function getPlayerTokenLabel(
  player: Pick<Player, 'name' | 'isInJail' | 'jailTurns' | 'position'>
) {
  const jail = getJailStatus(player);
  if (jail) return `${player.name}. ${jail.accessibilityLabel}`;
  return player.position === 10 ? `${player.name}. Just Visiting.` : player.name;
}
