/**
 * The text the lobby's Share button hands to the OS share sheet. Kept in a
 * pure `.ts` module so the node test environment can load it (see AGENTS.md
 * "File-extension discipline"). It carries only the public room code — never
 * the session token.
 */
export const buildRoomShareMessage = (roomId: string): string =>
  `Join my Trade Tycoon game! Room code: ${roomId}`;

/** How long the Copy button says "Copied" before it goes back to "Copy". */
export const COPIED_FEEDBACK_MS = 2000;
