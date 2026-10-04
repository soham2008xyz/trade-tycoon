# A rejected game action aborts the update and returns 409 to the actor only

The reducer can refuse an action in three ways: a hard `ACTION_REJECTED` sentinel, an unchanged input state, or a soft rejection that sets `errorMessage`. On the server all three are treated identically: the store update is aborted, nothing is persisted or broadcast, and the acting player alone gets a 409 carrying the message. This keeps private feedback (such as "can't afford it") out of shared state; in hotseat play the same `errorMessage` is shown as a toast.

The client-facing `gameReducer` still collapses the sentinel to "unchanged state" so it stays compatible with React's `useReducer`; the server calls the sentinel-aware function instead. `errorMessage` is also stripped at the serialization boundary as defence in depth.
