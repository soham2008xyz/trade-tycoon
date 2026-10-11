import type { RoomManager } from '../RoomManager';
import type { EventBus } from '../events/EventBus';

/**
 * Settles an expired turn/bid timer and tells the room about it.
 *
 * There is no background worker on Vercel, so deadlines are enforced lazily:
 * every route that touches a room calls this first, and each open SSE stream
 * calls it when the deadline it last saw comes due. The publish lives here
 * (not in `RoomManager`, which has no bus) so any caller that triggers an
 * expiry also broadcasts it, even when its own request then turns out to be
 * rejected.
 *
 * Best-effort: a failure here must not fail the request it piggybacks on —
 * `RoomManager.handleGameAction` re-checks the deadline inside its own
 * compare-and-swap, so a late action still can't slip past it.
 */
export const expireAndPublish = async (
  roomManager: RoomManager,
  eventBus: EventBus,
  roomId: string
): Promise<void> => {
  try {
    const expired = await roomManager.expireIfDue(roomId);
    if (expired) await eventBus.publish(roomId, { type: 'game_state_update', state: expired });
  } catch (err) {
    console.warn('[timers] expiry check failed for room %s', roomId, err);
  }
};
