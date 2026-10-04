/**
 * Last-seen tracking for the players in a room. Deliberately NOT part of
 * `LobbyState`: a native client polls every 2–5 s, and writing each poll into
 * the room record would be a whole-room CAS write per poll — contending with
 * real game actions and bumping `version` on every tick. See
 * docs/adr/0012-presence-lives-outside-the-room-record.md.
 *
 * Same shape as `RoomStore`/`EventBus`: an in-memory impl for tests + dev and a
 * Redis impl for production, chosen by `REDIS_URL` in `buildBackends()`.
 */
export interface PresenceStore {
  /** Record that `playerId` was seen at `now` (epoch ms). Last write wins. */
  touch(roomId: string, playerId: string, now: number): Promise<void>;

  /** playerId → last-seen epoch ms. Empty for an unknown room. */
  getLastSeen(roomId: string): Promise<ReadonlyMap<string, number>>;

  /** Record `now` only if the player has no record yet. */
  seedIfAbsent(roomId: string, playerId: string, now: number): Promise<void>;

  /** Drop one player's record. Idempotent. */
  forget(roomId: string, playerId: string): Promise<void>;
}

/**
 * A player unseen for longer than this is "disconnected". Three missed 15 s
 * SSE pings, and well above the 5 s ceiling of the native poll, so a slow
 * request or one dropped poll never flags anyone.
 */
export const PRESENCE_TIMEOUT_MS = 45_000;

/**
 * The single definition of the disconnect rule. Returns the ids from
 * `playerIds` (in that order) whose last-seen is strictly older than the
 * timeout. A player with no record counts as **present**: a cold start after a
 * deploy or Redis flush must not flag the whole table (callers `seedIfAbsent`
 * so such a player still goes stale later instead of never).
 */
export function getDisconnectedPlayerIds(
  playerIds: readonly string[],
  lastSeen: ReadonlyMap<string, number>,
  now: number
): string[] {
  return playerIds.filter((id) => {
    const seen = lastSeen.get(id);
    return seen !== undefined && now - seen > PRESENCE_TIMEOUT_MS;
  });
}
