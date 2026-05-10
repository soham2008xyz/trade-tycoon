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
