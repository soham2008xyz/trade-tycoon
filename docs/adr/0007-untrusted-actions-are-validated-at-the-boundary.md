# Untrusted actions are validated field by field at the network boundary

Actions arriving over the network pass through `parseGameAction` in `game-logic` before the reducer sees them. It is a hand-written validator rather than a schema library, because the action surface is small and fixed and `game-logic` stays dependency-free. It rebuilds each action from only the fields that action expects, so unrecognised extra fields are dropped, and it bounds every money amount to a non-negative safe integer. The reducer also checks these defensively.

The validator was added after the audit found that negative, fractional or string amounts in trades and bids could mint money or corrupt a balance through string concatenation.

## Decisions

- **Client-local and server-issued actions are rejected here, not in the reducer.** `RESET_GAME` and `JOIN_GAME` can never arrive from a player, and `DISMISS_ERROR` and `DISMISS_TOAST` are rejected too. Toast and error text is shared broadcast state, so accepting a dismissal online would let one player clear it for everyone and trigger a full-state broadcast. Dismissal stays a reducer action for hotseat play, and online the client hides the toast with local state instead.
- **Trading a property that has buildings is forbidden, not transferred.** This matches the Monopoly rules and needed less code than moving house records between players; it is enforced when a trade is proposed and again when it is accepted.
