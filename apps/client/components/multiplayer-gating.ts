import type { TradeRequest } from '@trade-tycoon/game-logic';

/**
 * Pure boolean predicates for "should this UI element be visible to the
 * local user". Extracted out of the modal components so the rules can be
 * unit-tested in a plain Node vitest environment without React, React
 * Native, or jsdom.
 *
 * The same predicates are used in two contexts:
 *
 * - **Local hotseat play** (`isMultiplayer === false`): one device, one user
 *   who passes it between players. Controls show on every relevant row /
 *   role; the user clicks whichever applies at the moment.
 *
 * - **Online multiplayer** (`isMultiplayer === true`): one browser per user.
 *   Controls only render on the row / for the role matching the local
 *   user's `selfId`, because that's the only thing the server will accept
 *   actions from anyway. Surfacing other rows' buttons would just generate
 *   click-and-fail noise.
 */

/**
 * Whether the auction row for `participantId` should render bid / fold
 * controls.
 *
 * Hotseat: every row renders controls; the existing `isTurn` /
 * `isHighestBidder` flags inside the modal then enable the right ones.
 *
 * Multiplayer: only the row matching `myPlayerId` renders controls.
 */
export const shouldShowAuctionControls = (
  participantId: string,
  isMultiplayer: boolean,
  myPlayerId: string | undefined
): boolean => {
  if (!isMultiplayer) return true;
  return participantId === myPlayerId;
};

/**
 * Whether the local user (`selfId`) should see the Accept / Reject buttons
 * on a pending trade. In multiplayer only the trade's target should see
 * them; in hotseat both buttons render so the user-at-device can act for
 * whichever player is the target.
 */
export const canAcceptTrade = (
  selfId: string,
  trade: Pick<TradeRequest, 'targetPlayerId'> | null | undefined,
  isMultiplayer: boolean
): boolean => {
  if (!trade) return false;
  return !isMultiplayer || trade.targetPlayerId === selfId;
};

/**
 * Whether the local user (`selfId`) should see the Cancel button on a
 * pending trade. In multiplayer only the initiator can cancel; in hotseat
 * the button always shows.
 */
export const canCancelTrade = (
  selfId: string,
  trade: Pick<TradeRequest, 'initiatorId'> | null | undefined,
  isMultiplayer: boolean
): boolean => {
  if (!trade) return false;
  return !isMultiplayer || trade.initiatorId === selfId;
};

/**
 * Whether the game-over card offers "New Game". Hotseat shares one device,
 * so the user can go straight back to player setup and dispatch `RESET_GAME`
 * locally. Online, `RESET_GAME` is server-issued only (the server rejects it
 * from clients) and a room can't be restarted from the finished game, so the
 * only way out is "Back to Menu" — which leaves the room.
 */
export const canStartNewGame = (isMultiplayer: boolean): boolean => !isMultiplayer;

/**
 * Whether the local user (`selfId`) should be offered "Remove" for `targetId`,
 * a player the server has stopped hearing from.
 *
 * Hotseat has no presence at all — one device, everyone "present" — so this is
 * always false there. Online, the target must be disconnected (a live player
 * can never be removed) and cannot be the local user. The authority matches the
 * server: the host, or anyone once the host is itself disconnected (otherwise a
 * vanished host would recreate the soft-lock). The local user's own client is
 * alive by definition, so their own presence is not part of the rule; the
 * server re-checks everything regardless.
 */
export const canRemovePlayer = ({
  selfId,
  hostId,
  targetId,
  disconnectedPlayerIds,
  isMultiplayer,
}: {
  selfId: string | undefined;
  hostId: string | undefined;
  targetId: string;
  disconnectedPlayerIds: readonly string[];
  isMultiplayer: boolean;
}): boolean => {
  if (!isMultiplayer || !selfId || !hostId) return false;
  if (targetId === selfId) return false;
  if (!disconnectedPlayerIds.includes(targetId)) return false;
  return selfId === hostId || disconnectedPlayerIds.includes(hostId);
};

/**
 * Whether the room has dropped the local player, i.e. they were removed while
 * away. Looks only at the **lobby** roster: a bankrupt player leaves
 * `gameState.players` but stays in the lobby until they leave, so keying this
 * on the game roster would bounce every bankrupt player to the menu. Unknown
 * state (no lobby yet, no local id) is never "removed".
 */
export const wasRemovedFromRoom = (
  lobby: { players: readonly { id: string }[] } | null | undefined,
  selfId: string | null | undefined
): boolean => {
  if (!lobby || !selfId) return false;
  return !lobby.players.some((player) => player.id === selfId);
};
