# Project Memory

- Online multiplayer leave is server-authoritative: `OnlineGame.handleLeave`
  must POST `/api/rooms/:id/leave` before returning to the menu, otherwise the
  departed player remains in the room snapshot and their board marker stays
  visible for other clients.
- Reducer-level `errorMessage` values are part of the user-facing game flow:
  client surfaces them through the in-game toast, so game-rule rejections
  should prefer setting `errorMessage` over silent no-ops when the player needs
  feedback.
- `apps/server` tests execute against the published `@trade-tycoon/game-logic`
  package shape, so the server workspace test script must rebuild
  `packages/game-logic` first or reducer changes can be invisible to server
  tests.
- The native iPad shell in `apps/client` is driven by the pure
  `ipad-native-presentation.ts` helper, and the board must size itself from
  the measured `GameUI` stage rather than raw `useWindowDimensions()` or the
  board will overflow when the tablet shell adds a sidebar.
