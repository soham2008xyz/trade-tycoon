# A rejected game action aborts the update and returns 409 to the actor only

The reducer can refuse an action in three ways: a hard `ACTION_REJECTED` sentinel, an unchanged input state, or a soft rejection that sets `errorMessage`. On the server all three are treated identically: the store update is aborted, nothing is persisted or broadcast, and the acting player alone gets a 409 carrying the message.

This was chosen because the previous behaviour, persisting and broadcasting every outcome, had two problems. A player's private feedback, such as "can't afford it", was visible to every player in the room. And a no-op was amplified into a full-state broadcast to everyone. In hotseat play the same `errorMessage` is still shown as a toast, so the reducer keeps setting it rather than staying silent.

The client-facing `gameReducer` collapses the sentinel to "unchanged state" so it stays compatible with React's `useReducer`; the server calls the sentinel-aware function instead. `errorMessage` is also stripped at the serialization boundary as defence in depth.

The mechanics, and how to keep the two sides in step, are documented in `packages/game-logic/AGENTS.md` and `apps/server/AGENTS.md`. They are not repeated here.
