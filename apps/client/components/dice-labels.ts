/**
 * Screen-reader sentence for the pair of dice (NO React — see "File-extension
 * discipline" in apps/client/AGENTS.md).
 *
 * The dice are icons, so without a label VoiceOver says nothing about the roll.
 * While rolling the shown values are stale, so the label says only that.
 */
export const getDiceAccessibilityLabel = (
  value1: number,
  value2: number,
  isRolling: boolean
): string => {
  if (isRolling) return 'Rolling dice';
  const doubles = value1 === value2 ? ', doubles' : '';
  return `Dice show ${value1} and ${value2}${doubles}, total ${value1 + value2}`;
};
