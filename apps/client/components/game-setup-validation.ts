/**
 * Pure validation + normalization for the local Game Setup form (NO React — see
 * "File-extension discipline" in apps/client/AGENTS.md).
 */
import {
  hasDuplicateColors,
  isValidPlayerName,
  normalizePlayerName,
} from '@trade-tycoon/game-logic';

interface SetupPlayer {
  name: string;
  color: string;
}

export type SetupValidation = { ok: true; players: SetupPlayer[] } | { ok: false; error: string };

export function validateSetupPlayers(players: SetupPlayer[]): SetupValidation {
  // Blank names would render as an unlabeled dot/square everywhere in the game.
  if (!players.every((p) => isValidPlayerName(p.name))) {
    return { ok: false, error: 'Every player needs a name.' };
  }
  // The swatches already disable taken colors; this guards against any path
  // that still lets two players share one (tokens and ownership dots would
  // be indistinguishable on the board).
  if (hasDuplicateColors(players)) {
    return { ok: false, error: 'Each player needs a different color.' };
  }
  // Same trim/cap as the server so hotseat and online names look alike.
  return { ok: true, players: players.map((p) => ({ ...p, name: normalizePlayerName(p.name) })) };
}
