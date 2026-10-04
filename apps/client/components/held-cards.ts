/** What the held-card badge shows for one player. */
export interface HeldCardsBadge {
  /** Short visible text, rendered beside the card icon (e.g. `×2`). */
  text: string;
  /** Screen-reader sentence for the whole badge (icon + text). */
  accessibilityLabel: string;
}

/**
 * Badge for a player's held Get Out of Jail Free cards, or `null` when they
 * hold none (so callers render nothing rather than an empty "×0" chip).
 *
 * The count is public shared game state — other players need it when deciding
 * trades — so unlike the predicates in `multiplayer-gating.ts` this does not
 * diverge between hotseat and online: every player's badge is shown to everyone.
 * Anything that is not a positive whole number (undefined from a stale
 * payload, NaN, negatives) is treated as "none held".
 */
export const getHeldCardsBadge = (count: number | undefined): HeldCardsBadge | null => {
  if (count === undefined || !Number.isInteger(count) || count <= 0) return null;
  return {
    text: `×${count}`,
    accessibilityLabel: `Holds ${count} Get Out of Jail Free ${count === 1 ? 'card' : 'cards'}`,
  };
};
