import { describe, it, expect } from 'vitest';
import {
  canAcceptTrade,
  canCancelTrade,
  canRemovePlayer,
  canStartNewGame,
  shouldShowAuctionControls,
  wasRemovedFromRoom,
} from './multiplayer-gating';

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

  describe('canStartNewGame', () => {
    it('hotseat: offers New Game (the device can go back to player setup)', () => {
      expect(canStartNewGame(false)).toBe(true);
    });

    it('multiplayer: no New Game — RESET_GAME is server-only, so the player can only leave', () => {
      expect(canStartNewGame(true)).toBe(false);
    });
  });

  describe('canRemovePlayer', () => {
    const base = {
      selfId: 'alice',
      hostId: 'alice',
      targetId: 'bob',
      disconnectedPlayerIds: ['bob'],
      isMultiplayer: true,
    };

    it('hotseat: never — there is no presence on one shared device', () => {
      expect(canRemovePlayer({ ...base, isMultiplayer: false })).toBe(false);
    });

    it('multiplayer host: can remove a disconnected player', () => {
      expect(canRemovePlayer(base)).toBe(true);
    });

    it('multiplayer host: cannot remove a connected player', () => {
      expect(canRemovePlayer({ ...base, disconnectedPlayerIds: [] })).toBe(false);
      expect(canRemovePlayer({ ...base, disconnectedPlayerIds: ['carol'] })).toBe(false);
    });

    it('cannot remove yourself, even when flagged', () => {
      expect(
        canRemovePlayer({ ...base, targetId: 'alice', disconnectedPlayerIds: ['alice'] })
      ).toBe(false);
    });

    it('multiplayer non-host: cannot remove while the host is connected', () => {
      expect(canRemovePlayer({ ...base, selfId: 'carol' })).toBe(false);
    });

    it('multiplayer non-host: can remove once the host is disconnected too', () => {
      expect(
        canRemovePlayer({ ...base, selfId: 'carol', disconnectedPlayerIds: ['alice', 'bob'] })
      ).toBe(true);
    });

    it('a disconnected host can be removed by a connected non-host', () => {
      expect(
        canRemovePlayer({
          ...base,
          selfId: 'carol',
          targetId: 'alice',
          disconnectedPlayerIds: ['alice'],
        })
      ).toBe(true);
    });

    it('missing ids: hidden in multiplayer', () => {
      expect(canRemovePlayer({ ...base, selfId: undefined })).toBe(false);
      expect(canRemovePlayer({ ...base, hostId: undefined })).toBe(false);
    });
  });

  describe('wasRemovedFromRoom', () => {
    const lobby = { players: [{ id: 'alice' }, { id: 'bob' }] };

    it('is false while the local player is still in the lobby roster', () => {
      expect(wasRemovedFromRoom(lobby, 'bob')).toBe(false);
    });

    it('is true once the local player is gone from the lobby roster', () => {
      expect(wasRemovedFromRoom({ players: [{ id: 'alice' }] }, 'bob')).toBe(true);
    });

    it('is false for a bankrupt player: they stay in the lobby after leaving the game', () => {
      // `gameState.players` no longer has them, but this predicate only ever
      // looks at the lobby roster, which keeps them until they leave.
      expect(wasRemovedFromRoom(lobby, 'bob')).toBe(false);
    });

    it('is false before there is a lobby or a local id to compare', () => {
      expect(wasRemovedFromRoom(null, 'bob')).toBe(false);
      expect(wasRemovedFromRoom(undefined, 'bob')).toBe(false);
      expect(wasRemovedFromRoom(lobby, null)).toBe(false);
    });
  });
});
