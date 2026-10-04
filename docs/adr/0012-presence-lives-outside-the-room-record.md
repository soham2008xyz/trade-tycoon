# Player presence lives outside the room record, and removal is manual

An online player whose client vanishes without calling Leave used to soft-lock the game for everyone else. The server now tracks when it last heard from each player, reports who has been quiet for more than 45 seconds, and lets the host (or anyone, once the host is gone too) remove a disconnected player through the same cleanup as leaving. Nothing is removed automatically.

## Decisions

- **Presence is its own store, not a field on `LobbyState`.** `PresenceStore` is a third pluggable backend next to `RoomStore` and `EventBus`, chosen by `REDIS_URL`; in Redis it is one hash per room, `presence:<roomId>`, with the room's 24 hour TTL. Putting `lastSeen` in the room record would turn every native poll (every 2 to 5 seconds) into a whole-room compare-and-swap write, contending with real game actions and bumping `version` on every tick.
- **Presence travels as a side channel.** Going stale is time-based, so no mutation fires when someone goes quiet. Each SSE stream computes the disconnected set itself and sends a `presence` event when it changes; `/reconnect` responses carry `disconnectedPlayerIds` for the native poll. It is never published on the `EventBus` and never touches `version`, so the client's poll compares presence on its own and the unchanged-version shortcut cannot hide a presence-only change.
- **Existing traffic is the heartbeat.** Create, join, reconnect, actions and an open event stream all record the player as seen; there is no heartbeat endpoint and no new client code. Presence is touched after a store update returns, never inside its mutator, because mutators must stay pure (see [ADR 0003](0003-room-state-in-redis-behind-pluggable-backends.md)).
- **A player with no record counts as present, but is seeded.** A deploy or Redis flush must not flag the whole table, yet a player who vanished before their first heartbeat must still go stale, so the read seeds a missing record at "now".
- **Presence is computed over the lobby roster.** A bankrupt player leaves the game roster but keeps their lobby entry and session. Judging the host against the game roster would make a bankrupt host who then vanishes permanently invisible and recreate the soft-lock. The removal _target_ is still checked against the game roster, since a bankrupt player has nothing left to be removed from.
- **Removal reuses leaving.** `removeDisconnectedPlayer` and `leaveRoom` share one `removePlayerFrom` helper, so turn advancement, auction and trade unwinding and host reassignment cannot drift apart. As with leaving, assets go to nobody ([ADR 0010](0010-bankruptcy-is-declared-and-settles-with-the-creditor.md)). Game rules did not change.
- **Who may remove.** The host, or any player once the host is disconnected. A live player can never be removed: the server re-checks that the target is disconnected, and an unreadable presence store rejects the removal (409) rather than assuming the target is gone. A removal request is itself an authenticated request, so it counts as a heartbeat for the caller.

## Considered options

- **Automatic removal after a timeout.** Rejected. A locked phone or a dropped connection should not cost anyone their game without a human deciding so, and it needs a sweeper on a platform with no background worker.
- **A "skip turn" action.** Rejected. It needs a new forced end-turn rule, and the absent player would stall every one of their later turns.
- **Presence in process memory.** Rejected: each request can land on a different instance.

## Consequences

- Redis cost goes up, which matters under per-command billing. A native poll adds a presence write (one pipelined round trip) and a presence read. Each open web SSE stream does a presence write, a room read and a presence read every 15 seconds.
- **Known limitation.** On Vercel a closed browser tab may not be noticed by the function until its roughly 300 second timeout, and until then the stream keeps pinging and recording the player as seen. A vanished _web_ player can therefore look present for up to about five minutes. Native clients poll, so they stop being seen promptly. Check on a preview deploy before relying on the web timing.
- **Accepted race.** A target can reconnect between the presence read and the store write and be removed while live. The window is small and the read is deliberately outside the mutator to keep it pure; do not move it inside to "fix" this.
