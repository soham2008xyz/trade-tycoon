# Turn deadlines are stamped by the server and enforced lazily

An idle or vanished player used to stall an online game until someone removed them by hand. Every player turn and every auction bidder's turn now has a deadline; when it passes, the server ends the turn or passes the bid and the game moves on.

## Decisions

- **The deadline lives in the game state.** `GameState.timer` (`kind`, `playerId`, `key`, absolute `deadline`) and `GameState.timerConfig` ride the room record, so they get the store's compare-and-swap atomicity and every instance sees the same clock. The reducer itself still knows nothing about time: the server calls the pure `stampTurnTimer(state, now)` after each accepted step and `expireTurnTimer(state, now, rng)` when a deadline has passed. Hotseat never calls them, so it has no timers.
- **One clock at a time, re-armed by identity.** `getTimerSubject` names what is being timed (the current player's turn, or the current bidder at the current bid). The deadline is re-armed only when that key changes, so rolling doubles, buying or managing property inside a turn cannot extend it, while every new turn, bidder or bid starts a fresh clock. When an auction ends, the turn clock restarts at the full limit.
- **Defined automatic actions.** An expired turn is ended through the ordinary END_TURN rule (so ending on an unowned tile still auctions it); a player in debt, who cannot end normally, is skipped anyway because the clock must be able to advance a stalled table. An expired bidder passes (CONCEDE_AUCTION); a high bidder, who cannot pass, wins the auction instead.
- **Enforcement is lazy, with no worker.** Vercel has no background process, so `RoomManager.expireIfDue` is called by every route that touches a room (actions, `/reconnect`, opening an event stream) and by each open SSE stream, which sets a timeout aimed at the deadline of the last state it wrote. It is a CAS, so any number of streams or instances racing apply the expiry once. Native clients get it on their next poll. The result is published on the `EventBus` like any other update.
- **Late actions lose.** `handleGameAction` settles an overdue deadline inside its own update before running the action, and the actions route also settles it first so the timeout is persisted and broadcast even when the late action is then rejected (409). A late action therefore only ever sees the post-timeout game.
- **At most one step per touch.** After a long idle, only the stalled turn is skipped and the next deadline counts from now, so reviving a room does not run every seat's clock out in a row.
- **Clients count down from `remainingMs`.** The public serializer adds `remainingMs` (deadline minus the server's clock at serialization) to the timer on the wire, never in storage. The client turns it into a local `expiresAt` on arrival (`localizeTurnTimer`), so a client with a skewed clock, a reconnecting client and a mid-turn joiner all show the same remaining time.
- **Configuration.** `TURN_TIME_LIMIT_SECONDS` (default 180) and `AUCTION_TURN_TIME_LIMIT_SECONDS` (default 30), independent; `0` disables that timer. They are snapshotted into each game when it starts, so changing the env vars never alters a game in progress.

## Considered options

- **Client-side timers that dispatch a timeout action.** Rejected: bypassable, and racy when several clients fire at once.
- **A cron or sweeper expiring rooms.** Rejected for the same reason as automatic removal in [ADR 0012](0012-presence-lives-outside-the-room-record.md): no background worker on the platform.
- **Pausing a timer while a modal like Manage or Trade is open.** Rejected: that state is client-local, and honoring it would let a player stall indefinitely.
- **Per-room limits chosen in the lobby.** Deferred; the env vars and the snapshot into `timerConfig` leave room for it.

## Consequences

- The deadline is only enforced while something is touching the room. An abandoned room stays as it was until someone returns, and then skips exactly one turn.
- A native client can see 0:00 for up to one poll interval (2 to 5 s) before the skip arrives.
- The turn limit also covers time spent in trades and property management, and keeps running for a disconnected player; skipping them is the point, and the host can still remove them.
- Expiry reads the manager's clock; with instances whose clocks drift apart by more than the 50 ms slack, a stream may re-arm once before the expiry lands.
