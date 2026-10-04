import {
  ACTION_REJECTED,
  GameState,
  LobbyPlayer,
  LobbyState,
  createInitialState,
  reduceGameAction,
  removePlayerFromGame,
  GameAction,
  createPlayer,
  mulberry32,
  PLAYER_COLORS,
  isColorTakenByOthers,
  normalizePlayerName,
} from '@trade-tycoon/game-logic';
import { randomBytes, randomInt } from 'crypto';
import type { RoomStore } from './store/RoomStore';
import type { PresenceStore } from './presence/PresenceStore';
import { getDisconnectedPlayerIds } from './presence/PresenceStore';
import { InMemoryPresenceStore } from './presence/InMemoryPresenceStore';
import { toPublicGameState, toPublicLobbyState } from './serialize';

const MAX_ROOM_ID_RETRIES = 10;
const MAX_PLAYERS_PER_ROOM = 8;

export interface CreateRoomResult {
  roomId: string;
  playerId: string;
  token: string;
}

export interface JoinRoomResult {
  playerId: string;
  token: string;
  state: LobbyState;
}

/**
 * Failure arm shared by every lobby-lifecycle method. `reason` maps 1:1 to an
 * HTTP status in the routes (not_found → 404, unauthorized → 401,
 * conflict → 409) so callers never have to re-fetch the room to figure out
 * *why* a mutation failed.
 */
export interface RoomFailure {
  ok: false;
  reason: 'not_found' | 'unauthorized' | 'conflict';
  message: string;
}

export type RoomResult<T> = ({ ok: true } & T) | RoomFailure;

export type GameActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'unauthorized' | 'rejected'; message: string };

/**
 * Shared failure for reconnect/leave: whether the room is gone or the token
 * is stale, the caller's stored session is unusable and the client should
 * discard it. The client's resume flow branches on 404 `session_expired`, so
 * these two endpoints intentionally never distinguish an auth failure (401).
 */
const SESSION_EXPIRED: RoomFailure = {
  ok: false,
  reason: 'not_found',
  message: 'session_expired',
};

const INVALID_TOKEN_MESSAGE = 'Invalid or expired session token';

/**
 * Encapsulates all multiplayer business logic: room lifecycle, player joins,
 * starting games, and applying game actions. State persistence is delegated
 * to a `RoomStore` so the same logic runs on top of an in-memory Map (tests
 * + dev) or Upstash Redis (Vercel production).
 *
 * Every public method is async because the production store is over the
 * network. The mutator passed to `store.update` may be retried on a Redis
 * WATCH conflict, so it must remain a pure function of the input state — any
 * side effects (id generation, color assignment) that need to land exactly
 * once must be captured outside the closure.
 *
 * Auth model: each player is identified publicly by `playerId` (broadcast to
 * every client in room/game state) and privately by a `token` (returned only
 * to that player, over the response body of create/join). `token` is the
 * actual credential — every mutating call resolves `playerId` from the
 * caller's `token` via the room's `sessions` map, so knowing another player's
 * public id (which every client can see) confers no ability to act as them.
 */
export class RoomManager {
  private readonly presence: PresenceStore;
  private readonly clock: () => number;

  /**
   * `presence` and `clock` are optional so callers that don't care about
   * presence (and the many existing tests) keep working: the defaults are an
   * in-memory store and the wall clock. Tests inject a controllable clock to
   * age presence deterministically.
   */
  constructor(
    private readonly store: RoomStore,
    options: { presence?: PresenceStore; clock?: () => number } = {}
  ) {
    this.presence = options.presence ?? new InMemoryPresenceStore();
    this.clock = options.clock ?? Date.now;
  }

  /**
   * Best-effort heartbeat. A presence-store failure must never fail the request
   * it piggybacks on, and this must never be called from inside a store
   * mutator (those are synchronous, pure and may be retried — ADR 0003), so
   * callers capture the playerId and touch after the update returns.
   */
  private async touch(roomId: string, playerId: string): Promise<void> {
    try {
      await this.presence.touch(roomId, playerId, this.clock());
    } catch (err) {
      console.warn(`[RoomManager] presence touch failed for room ${roomId}`, err);
    }
  }

  /** Public heartbeat for callers that already authenticated (the SSE route). */
  async recordSeen(roomId: string, playerId: string): Promise<void> {
    await this.touch(roomId.trim().toUpperCase(), playerId);
  }

  /**
   * Ids of players in a running game who have not been seen for longer than
   * `PRESENCE_TIMEOUT_MS`. Computed over the **lobby** roster, not
   * `gameState.players`: a bankrupt player leaves the game roster but keeps
   * their lobby entry and session, and a bankrupt host who then vanishes must
   * still be flaggable or the host-gone removal fallback could never fire.
   *
   * Fails open: if presence can't be read nobody is flagged, so an outage can
   * only ever withhold the remove button, never open it wrongly.
   */
  async getDisconnectedPlayerIds(roomId: string, knownRoom?: LobbyState): Promise<string[]> {
    roomId = roomId.trim().toUpperCase();
    try {
      // Callers that just read the room (reconnect) pass it to save a Redis GET.
      const room = knownRoom ?? (await this.store.get(roomId));
      if (!room?.gameState || room.gameState.winner) return [];

      const now = this.clock();
      const lastSeen = await this.presence.getLastSeen(roomId);
      const ids = room.players.map((p) => p.id);

      // A player with no record counts as present (a deploy or Redis flush must
      // not flag the whole table) — but seed one so they go stale 45 s later
      // rather than staying "present" forever.
      await Promise.all(
        ids
          .filter((id) => !lastSeen.has(id))
          .map((id) => this.presence.seedIfAbsent(roomId, id, now))
      );

      return getDisconnectedPlayerIds(ids, lastSeen, now);
    } catch (err) {
      console.warn(`[RoomManager] presence read failed for room ${roomId}`, err);
      return [];
    }
  }

  async createRoom(hostName: string): Promise<CreateRoomResult> {
    const hostId = this.generateUserId();
    const token = this.generateToken();
    const hostPlayer: LobbyPlayer = {
      id: hostId,
      name: normalizePlayerName(hostName),
      color: this.getRandomColor(),
      isHost: true,
      isReady: true,
    };

    for (let i = 0; i < MAX_ROOM_ID_RETRIES; i++) {
      const roomId = this.generateRoomId();
      const created = await this.store.create({
        roomId,
        players: [hostPlayer],
        status: 'lobby',
        sessions: { [token]: hostId },
        version: 1,
      });
      if (created) {
        console.log(`[RoomManager] Creating room ${roomId} for host ${hostName} (${hostId})`);
        await this.touch(roomId, hostId);
        return { roomId, playerId: hostId, token };
      }
    }
    throw new Error('Could not allocate a unique room id after multiple attempts');
  }

  async joinRoom(roomId: string, playerName: string): Promise<RoomResult<JoinRoomResult>> {
    roomId = roomId.trim().toUpperCase();

    // The id/token are generated once outside the mutator so that even if the
    // store's retry-on-conflict logic runs the closure twice we hand back a
    // stable pair.
    const userId = this.generateUserId();
    const token = this.generateToken();

    // Captured from inside the mutator so the caller learns *why* the join
    // was refused. If it stays null after a failed update, the store never
    // invoked the mutator — the room doesn't exist.
    let conflictMessage: string | null = null;

    const state = await this.bumpedUpdate(roomId, (current) => {
      if (current.status !== 'lobby') {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is in progress`);
        conflictMessage = 'Room is already in progress';
        return null;
      }
      if (current.players.length >= MAX_PLAYERS_PER_ROOM) {
        console.warn(`[RoomManager] Join failed: Room ${roomId} is full`);
        conflictMessage = 'Room is full';
        return null;
      }
      const newPlayer: LobbyPlayer = {
        id: userId,
        name: normalizePlayerName(playerName),
        color: this.getRandomColor(current.players.map((p) => p.color)),
        isHost: current.players.length === 0,
        isReady: true,
      };
      return {
        ...current,
        players: [...current.players, newPlayer],
        sessions: { ...(current.sessions ?? {}), [token]: userId },
      };
    });

    if (!state) {
      if (conflictMessage) {
        return { ok: false, reason: 'conflict', message: conflictMessage };
      }
      console.warn(`[RoomManager] Join failed: Room ${roomId} not found`);
      return { ok: false, reason: 'not_found', message: 'Room not found' };
    }

    console.log(`[RoomManager] Player ${playerName} (${userId}) joined room ${roomId}`);
    await this.touch(roomId, userId);
    return { ok: true, playerId: userId, token, state: toPublicLobbyState(state) };
  }

  /**
   * Resolves a private session token to the public player id it
   * authenticates. Looks the token up via `Map.get` rather than a bracket
   * lookup on `current.sessions` directly, so a token equal to
   * `"__proto__"`/`"constructor"`/`"toString"` can't read an inherited
   * `Object.prototype` value instead of a real session (generic-object-
   * injection — `Map` has no prototype-chain entries to collide with).
   */
  private resolvePlayerId(current: LobbyState, token: string): string | null {
    if (!current.sessions) return null;
    return new Map(Object.entries(current.sessions)).get(token) ?? null;
  }

  /**
   * Wraps `store.update` so every successful write bumps `version`. Kept as
   * the one place that does this rather than repeating it in every mutator
   * below.
   */
  private bumpedUpdate(
    roomId: string,
    mutator: (_current: LobbyState) => LobbyState | null
  ): Promise<LobbyState | null> {
    return this.store.update(roomId, (current) => {
      const next = mutator(current);
      if (!next) return null;
      return { ...next, version: (current.version ?? 0) + 1 };
    });
  }

  /**
   * The single definition of "this player is no longer in the room": drops
   * their lobby entry and session, reassigns the host if needed, and removes
   * them from the running game (which advances the turn and unwinds auctions
   * and trades). Shared by a player leaving and by the room removing a
   * disconnected player so the two paths cannot drift apart.
   *
   * Pure function of `current` (it runs inside store mutators, which may be
   * retried). The caller must have checked that `userId` is in the lobby.
   */
  private removePlayerFrom(current: LobbyState, userId: string): LobbyState {
    const remainingSessions = Object.fromEntries(
      Object.entries(current.sessions ?? {}).filter(([, id]) => id !== userId)
    );

    const remainingPlayers = current.players.filter((entry) => entry.id !== userId);
    const reassignedPlayers = remainingPlayers.map((entry, index) => ({
      ...entry,
      isHost: remainingPlayers.some((candidate) => candidate.isHost) ? entry.isHost : index === 0,
    }));

    if (reassignedPlayers.length === 0) {
      return {
        ...current,
        players: [],
        status: 'lobby' as const,
        gameState: undefined,
        sessions: remainingSessions,
      };
    }

    if (!current.gameState) {
      return {
        ...current,
        players: reassignedPlayers,
        sessions: remainingSessions,
      };
    }

    // A finished game is a frozen snapshot. `removePlayerFromGame` skips the
    // reducer's post-game guard, and bankrupt players are already gone from
    // `gameState.players`, so the winner leaving would empty the roster and
    // reset `winner` — dropping the game-over screen for everyone still
    // connected. Keep the snapshot; only the lobby entry and session go.
    if (current.gameState.winner) {
      return {
        ...current,
        players: reassignedPlayers,
        sessions: remainingSessions,
      };
    }

    const nextGameState = removePlayerFromGame(current.gameState, userId);

    if (nextGameState.players.length === 0) {
      return {
        ...current,
        players: reassignedPlayers,
        status: 'lobby' as const,
        gameState: undefined,
        sessions: remainingSessions,
      };
    }

    return {
      ...current,
      players: reassignedPlayers,
      gameState: nextGameState,
      sessions: remainingSessions,
    };
  }

  async leaveRoom(
    roomId: string,
    token: string
  ): Promise<RoomResult<{ state: LobbyState; gameState: GameState | null }>> {
    roomId = roomId.trim().toUpperCase();

    const updated = await this.bumpedUpdate(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      if (!userId) return null;
      const player = current.players.find((entry) => entry.id === userId);
      if (!player) return null;
      return this.removePlayerFrom(current, userId);
    });

    // Whether the room is gone or the token is stale, the caller's session is
    // unusable either way — both collapse to the 404 `session_expired` the
    // client's resume flow keys off (deliberately NOT a 401; see routes).
    if (!updated) return SESSION_EXPIRED;

    return {
      ok: true,
      state: toPublicLobbyState(updated),
      gameState: updated.gameState ? toPublicGameState(updated.gameState) : null,
    };
  }

  /**
   * Removes a player the room has stopped hearing from, so the game can go on
   * without them. Allowed for the host, or for anyone once the host is itself
   * disconnected (otherwise a vanished host would recreate the soft-lock one
   * level up). The target must currently be disconnected — a live player can
   * never be removed.
   *
   * The presence read happens *before* the store update, so the mutator stays
   * a pure function of its input (ADR 0003). That leaves a small, accepted
   * window where a target reconnects between the read and the write; do not
   * "fix" it by moving the read into the mutator.
   */
  async removeDisconnectedPlayer(
    roomId: string,
    token: string,
    targetPlayerId: string
  ): Promise<RoomResult<{ state: LobbyState; gameState: GameState | null }>> {
    roomId = roomId.trim().toUpperCase();

    // An authenticated request proves the caller is alive, so count it before
    // reading presence — otherwise a host whose last poll was just over the
    // timeout ago would be judged disconnected by their own request.
    const auth = await this.authenticate(roomId, token);
    if (auth) await this.touch(roomId, auth.playerId);

    const disconnected = new Set(await this.getDisconnectedPlayerIds(roomId));

    let failure: RoomFailure | null = null;
    const reject = (reason: RoomFailure['reason'], message: string): null => {
      failure = { ok: false, reason, message };
      return null;
    };

    const updated = await this.bumpedUpdate(roomId, (current) => {
      const callerId = this.resolvePlayerId(current, token);
      const caller = callerId ? current.players.find((p) => p.id === callerId) : undefined;
      if (!callerId || !caller) return reject('unauthorized', INVALID_TOKEN_MESSAGE);

      const game = current.gameState;
      if (!game || game.winner) return reject('conflict', 'No game is in progress');

      if (targetPlayerId === callerId) return reject('conflict', 'You cannot remove yourself');
      // Checked against the *game* roster: a bankrupt player is already out of
      // the game and has nothing left to be removed from.
      if (!game.players.some((p) => p.id === targetPlayerId)) {
        return reject('conflict', 'Player not found');
      }
      if (!disconnected.has(targetPlayerId)) {
        return reject('conflict', 'Player is still connected');
      }

      // Checked against the *lobby* roster: a bankrupt host is still the host.
      const host = current.players.find((p) => p.isHost);
      const hostGone = !!host && disconnected.has(host.id);
      if (!caller.isHost && !hostGone) {
        return reject('conflict', 'Only the host can remove a player');
      }

      console.log(`[RoomManager] ${callerId} removed disconnected ${targetPlayerId} in ${roomId}`);
      return this.removePlayerFrom(current, targetPlayerId);
    });

    if (!updated) {
      if (failure) return failure;
      return { ok: false, reason: 'not_found', message: 'Room not found' };
    }

    try {
      await this.presence.forget(roomId, targetPlayerId);
    } catch (err) {
      console.warn(`[RoomManager] presence forget failed for room ${roomId}`, err);
    }

    return {
      ok: true,
      state: toPublicLobbyState(updated),
      gameState: updated.gameState ? toPublicGameState(updated.gameState) : null,
    };
  }

  // Handle re-connection
  async reconnect(
    roomId: string,
    token: string
  ): Promise<
    RoomResult<{ state: LobbyState; gameState?: GameState; disconnectedPlayerIds: string[] }>
  > {
    roomId = roomId.trim().toUpperCase();
    const room = await this.store.get(roomId);
    if (!room) return SESSION_EXPIRED;

    const userId = this.resolvePlayerId(room, token);
    if (!userId) return SESSION_EXPIRED;

    // Check if player exists in lobby
    const playerInLobby = room.players.find((p) => p.id === userId);

    // Check if player exists in running game
    const playerInGame = room.gameState?.players.find((p) => p.id === userId);

    if (!playerInLobby && !playerInGame) return SESSION_EXPIRED;

    // Touch before reading so the polling client sees its own heartbeat
    // registered in the same round trip.
    await this.touch(roomId, userId);

    return {
      ok: true,
      state: toPublicLobbyState(room),
      gameState: room.gameState ? toPublicGameState(room.gameState) : undefined,
      disconnectedPlayerIds: await this.getDisconnectedPlayerIds(roomId, room),
    };
  }

  async updatePlayer(
    roomId: string,
    token: string,
    name: string,
    color: string
  ): Promise<RoomResult<{ state: LobbyState }>> {
    roomId = roomId.trim().toUpperCase();

    let unauthorized = false;

    const updated = await this.bumpedUpdate(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      if (!userId) {
        unauthorized = true;
        return null;
      }
      const player = current.players.find((p) => p.id === userId);
      if (!player) {
        unauthorized = true;
        return null;
      }

      // Basic validation: name length, unique color
      // If color is taken by someone else, ignore change (or pick random)
      const isColorTaken = isColorTakenByOthers(
        current.players,
        current.players.indexOf(player),
        color
      );

      const updatedPlayers = current.players.map((p) =>
        p.id === userId
          ? {
              ...p,
              // Same rule as create/join; a blank rename keeps the current name.
              name: normalizePlayerName(name) || p.name,
              color: isColorTaken ? p.color : color,
            }
          : p
      );
      return { ...current, players: updatedPlayers };
    });

    if (!updated) {
      if (unauthorized) {
        return { ok: false, reason: 'unauthorized', message: INVALID_TOKEN_MESSAGE };
      }
      return { ok: false, reason: 'not_found', message: 'Room not found' };
    }
    return { ok: true, state: toPublicLobbyState(updated) };
  }

  /**
   * On success returns the updated public lobby state (which embeds the new
   * `gameState`) so the route can publish it directly without re-fetching.
   */
  async startGame(roomId: string, token: string): Promise<RoomResult<{ state: LobbyState }>> {
    roomId = roomId.trim().toUpperCase();

    let failure: RoomFailure | null = null;

    const updated = await this.bumpedUpdate(roomId, (current) => {
      const userId = this.resolvePlayerId(current, token);
      if (!userId) {
        console.warn(`[RoomManager] Start failed: unknown session token for room ${roomId}`);
        failure = { ok: false, reason: 'unauthorized', message: INVALID_TOKEN_MESSAGE };
        return null;
      }
      const player = current.players.find((p) => p.id === userId);
      if (!player || !player.isHost) {
        console.warn(`[RoomManager] Start failed: caller is not host in room ${roomId}`);
        failure = { ok: false, reason: 'conflict', message: 'Only the host can start the game' };
        return null;
      }
      if (current.players.length < 2) {
        console.warn(`[RoomManager] Start failed: Not enough players in room ${roomId}`);
        failure = {
          ok: false,
          reason: 'conflict',
          message: 'At least 2 players are required to start',
        };
        return null;
      }

      console.log(
        `[RoomManager] Starting game in room ${roomId} with ${current.players.length} players`
      );

      const gameState = createInitialState();
      const gamePlayers = current.players.map((p) => {
        const gp = createPlayer(p.id, p.name);
        gp.color = p.color;
        return gp;
      });
      gameState.players = gamePlayers;
      gameState.currentPlayerId = gamePlayers[0].id;

      return { ...current, status: 'game' as const, gameState };
    });

    if (!updated) {
      if (failure) return failure;
      console.warn(`[RoomManager] Start failed: Room ${roomId} not found`);
      return { ok: false, reason: 'not_found', message: 'Room not found' };
    }

    return { ok: true, state: toPublicLobbyState(updated) };
  }

  async handleGameAction(
    roomId: string,
    token: string,
    action: GameAction
  ): Promise<GameActionResult> {
    roomId = roomId.trim().toUpperCase();

    // Security Check: RESET_GAME has no playerId field — clients must NEVER be
    // able to send it (it would let any player wipe the game). Only the server
    // may dispatch it.
    if (action.type === 'RESET_GAME') {
      console.warn(`[RoomManager] Rejected client-issued RESET_GAME`);
      return { ok: false, reason: 'rejected', message: 'Action rejected' };
    }

    // Sanitize untrusted action input. The reducer accepts client-provided dice
    // (die1/die2) to support deterministic tests, but on a server those values
    // would let a malicious client pick favorable rolls. Force server-side RNG.
    const safeAction =
      action.type === 'ROLL_DICE'
        ? ({ ...action, die1: undefined, die2: undefined } as GameAction)
        : action;

    // Generated once outside the mutator: if a Redis CAS conflict re-invokes
    // the mutator, a fresh mulberry32(seed) instance replays the exact same
    // dice roll / card draw instead of silently re-rolling on retry.
    const seed = this.generateRngSeed();

    // Captured from inside the mutator so the caller learns *why* a rejected
    // action was rejected. Safe to reassign across CAS retries: only the
    // outcome of the most recent (successful-or-aborted) mutator invocation
    // matters, and an aborted mutator never triggers a retry.
    let rejectionMessage = 'Action rejected';
    let rejectionReason: 'unauthorized' | 'rejected' = 'rejected';
    // The token-resolved caller, captured so presence can be touched *after*
    // the update (never inside the mutator). Set even when the action is later
    // rejected: any authenticated request proves the player is alive.
    let authenticatedPlayerId: string | null = null;

    const updated = await this.bumpedUpdate(roomId, (current) => {
      if (!current.gameState) {
        rejectionMessage = 'Game has not started';
        return null;
      }

      const userId = this.resolvePlayerId(current, token);
      authenticatedPlayerId = userId;
      if (!userId) {
        console.warn(`[RoomManager] Unknown/expired session token for room ${roomId}`);
        rejectionReason = 'unauthorized';
        rejectionMessage = INVALID_TOKEN_MESSAGE;
        return null;
      }

      // Check if user is in the game
      const player = current.gameState.players.find((p) => p.id === userId);
      if (!player) {
        console.warn(`[RoomManager] User ${userId} not in game ${roomId}`);
        return null;
      }

      // The action's playerId must match the token-authenticated user.
      if ('playerId' in safeAction && (safeAction as { playerId: string }).playerId !== userId) {
        console.warn(
          `[RoomManager] User ${userId} tried to act as ${(safeAction as { playerId: string }).playerId}`
        );
        return null;
      }

      const newState = reduceGameAction(current.gameState, safeAction, mulberry32(seed));
      if (newState === ACTION_REJECTED) {
        console.warn(`[RoomManager] Rejected ${safeAction.type} from ${userId}`);
        return null;
      }

      // A soft rejection (e.g. "insufficient funds") carries a player-facing
      // errorMessage but is otherwise the same state. Broadcasting it would
      // leak that private feedback to every player in the room (M9) and
      // amplify a no-op into a full-state fan-out (M5) — abort instead and
      // report it back to only the caller via the HTTP response.
      if (newState.errorMessage) {
        rejectionMessage = newState.errorMessage;
        return null;
      }

      // Pure no-op guard clauses (e.g. acting out of turn) return the exact
      // same state reference — nothing changed, so there's nothing to persist
      // or broadcast.
      if (newState === current.gameState) {
        return null;
      }

      return { ...current, gameState: newState };
    });

    if (authenticatedPlayerId) await this.touch(roomId, authenticatedPlayerId);

    if (!updated?.gameState) {
      return { ok: false, reason: rejectionReason, message: rejectionMessage };
    }
    return { ok: true, state: toPublicGameState(updated.gameState) };
  }

  async getRoom(roomId: string): Promise<LobbyState | null> {
    const room = await this.store.get(roomId.trim().toUpperCase());
    return room ? toPublicLobbyState(room) : null;
  }

  /**
   * Resolves a session token to its public player id, for callers (the SSE
   * route) that need to authenticate a request without going through one of
   * the state-mutating methods above.
   */
  async authenticate(
    roomId: string,
    token: string
  ): Promise<{ playerId: string; room: LobbyState } | null> {
    const room = await this.store.get(roomId.trim().toUpperCase());
    if (!room) return null;
    const playerId = this.resolvePlayerId(room, token);
    if (!playerId) return null;
    return { playerId, room: toPublicLobbyState(room) };
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(randomInt(chars.length));
    }
    return result;
  }

  private generateUserId(): string {
    return randomBytes(9).toString('base64url');
  }

  private generateToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /** Extracted as its own method so tests can force a deterministic seed. */
  private generateRngSeed(): number {
    return randomInt(0, 2 ** 31);
  }

  private getRandomColor(excludeColors: string[] = []): string {
    const available = PLAYER_COLORS.filter((c) => !excludeColors.includes(c));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // Fallback to random
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }
}
