/**
 * Pure validation for the online create/join form (NO React — see
 * "File-extension discipline" in apps/client/AGENTS.md).
 *
 * Kept apart from the component's server/lobby `error` state: these messages
 * describe the form's current field values, so the component clears them as
 * soon as a field is edited and never renders them outside the form screen.
 */
import { isValidPlayerName } from '@trade-tycoon/game-logic';

export type ConnectFormMode = 'create' | 'join';

/** Returns a user-facing message for the first problem found, or null if valid. */
export function validateConnectForm(
  mode: ConnectFormMode,
  playerName: string,
  roomCode: string
): string | null {
  if (mode === 'create') {
    return isValidPlayerName(playerName) ? null : 'Please enter your name';
  }
  return isValidPlayerName(playerName) && roomCode.trim()
    ? null
    : 'Please enter name and room code';
}
