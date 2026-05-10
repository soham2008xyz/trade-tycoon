import { describe, it, expect } from 'vitest';
import { canAcceptTrade, canCancelTrade, shouldShowAuctionControls } from './multiplayer-gating';

const trade = {
  id: 'trade-1',
  initiatorId: 'alice',
  targetPlayerId: 'bob',
};

describe('multiplayer-gating', () => {
  describe('shouldShowAuctionControls', () => {
    it('hotseat: every participant row shows controls (the device is shared)', () => {
      expect(shouldShowAuctionControls('alice', false, 'alice')).toBe(true);
      expect(shouldShowAuctionControls('bob', false, 'alice')).toBe(true);
      // Even with no myPlayerId hotseat still renders for everyone.
      expect(shouldShowAuctionControls('alice', false, undefined)).toBe(true);
    });

    it("multiplayer: only the local user's row shows controls", () => {
      expect(shouldShowAuctionControls('alice', true, 'alice')).toBe(true);
      expect(shouldShowAuctionControls('bob', true, 'alice')).toBe(false);
    });

    it('multiplayer: a missing myPlayerId hides every row', () => {
      // This is the safety case for "the local user is not a participant
      // in the auction at all" — e.g. the player who declined to buy.
      expect(shouldShowAuctionControls('alice', true, undefined)).toBe(false);
      expect(shouldShowAuctionControls('bob', true, undefined)).toBe(false);
    });
  });

  describe('canAcceptTrade', () => {
    it('returns false when there is no active trade', () => {
      expect(canAcceptTrade('alice', null, true)).toBe(false);
      expect(canAcceptTrade('alice', null, false)).toBe(false);
      expect(canAcceptTrade('alice', undefined, true)).toBe(false);
    });

    it('hotseat: Accept/Reject visible to anyone holding the device', () => {
      expect(canAcceptTrade('alice', trade, false)).toBe(true);
      expect(canAcceptTrade('bob', trade, false)).toBe(true);
      expect(canAcceptTrade('charlie', trade, false)).toBe(true);
    });

    it('multiplayer: only the trade target can accept/reject', () => {
      expect(canAcceptTrade('bob', trade, true)).toBe(true); // target
      expect(canAcceptTrade('alice', trade, true)).toBe(false); // initiator
      expect(canAcceptTrade('charlie', trade, true)).toBe(false); // bystander
    });
  });

  describe('canCancelTrade', () => {
    it('returns false when there is no active trade', () => {
      expect(canCancelTrade('alice', null, true)).toBe(false);
      expect(canCancelTrade('alice', null, false)).toBe(false);
      expect(canCancelTrade('alice', undefined, true)).toBe(false);
    });

    it('hotseat: Cancel visible regardless of identity', () => {
      expect(canCancelTrade('alice', trade, false)).toBe(true);
      expect(canCancelTrade('bob', trade, false)).toBe(true);
    });

    it('multiplayer: only the initiator can cancel', () => {
      expect(canCancelTrade('alice', trade, true)).toBe(true); // initiator
      expect(canCancelTrade('bob', trade, true)).toBe(false); // target
      expect(canCancelTrade('charlie', trade, true)).toBe(false); // bystander
    });
  });

  describe('hotseat ↔ multiplayer parity', () => {
    // Concrete scenarios documenting the exact UX both modes promise. If
    // someone tries to "simplify" the helpers later this captures the shape
    // we expect.

    it('hotseat: every multi-player surface still works for the user-at-the-device', () => {
      // Auction with three bidders — all three rows have controls.
      expect(shouldShowAuctionControls('alice', false, 'alice')).toBe(true);
      expect(shouldShowAuctionControls('bob', false, 'alice')).toBe(true);
      expect(shouldShowAuctionControls('carol', false, 'alice')).toBe(true);
      // A pending trade — Accept/Reject and Cancel both render.
      expect(canAcceptTrade('alice', trade, false)).toBe(true);
      expect(canCancelTrade('alice', trade, false)).toBe(true);
    });

    it('multiplayer: each role sees exactly the controls it can act on', () => {
      // Auction: "alice" is the local user, only her row has controls.
      expect(shouldShowAuctionControls('alice', true, 'alice')).toBe(true);
      expect(shouldShowAuctionControls('bob', true, 'alice')).toBe(false);

      // Trade: alice initiated, bob is target.
      // Bob's screen: sees Accept/Reject, no Cancel.
      expect(canAcceptTrade('bob', trade, true)).toBe(true);
      expect(canCancelTrade('bob', trade, true)).toBe(false);
      // Alice's screen: no Accept/Reject, sees Cancel.
      expect(canAcceptTrade('alice', trade, true)).toBe(false);
      expect(canCancelTrade('alice', trade, true)).toBe(true);
      // Charlie (third party) sees neither.
      expect(canAcceptTrade('charlie', trade, true)).toBe(false);
      expect(canCancelTrade('charlie', trade, true)).toBe(false);
    });
  });
});
