/**
 * Player-name rule shared by local Game Setup, the online connect form and
 * `RoomManager`, so hotseat and online games can't disagree about what a legal
 * name is. The cap keeps names from wrapping the Players list and pushing a
 * row's Trade button off-screen.
 */
export const MAX_PLAYER_NAME_LENGTH = 15;

/** Trims surrounding whitespace, then caps the length. May return ''. */
export const normalizePlayerName = (name: string): string =>
  name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);

/** True when the name still has visible characters after normalizing. */
export const isValidPlayerName = (name: string): boolean => normalizePlayerName(name) !== '';
