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

/**
 * For a controlled name input's `onChangeText`. Replaces `maxLength`, which
 * counts leading spaces toward the cap before `normalizePlayerName` trims them
 * (so "     " + 15 letters would lose 5 visible characters). Dropping leading
 * whitespace first keeps what is typed identical to what normalizing keeps.
 */
export const limitPlayerNameInput = (text: string): string =>
  text.trimStart().slice(0, MAX_PLAYER_NAME_LENGTH);

// Whitespace/separators plus control (\p{Cc}) and format (\p{Cf}, e.g. U+200B
// zero-width space) characters render as nothing, so a name made only of them
// would show up as an unlabeled player.
const INVISIBLE = /[\s\p{Z}\p{Cc}\p{Cf}]/gu;

/** True when the name has at least one visible character. */
export const isValidPlayerName = (name: string): boolean =>
  normalizePlayerName(name).replace(INVISIBLE, '') !== '';
