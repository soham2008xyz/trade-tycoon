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
- ~~iPad shell~~ removed (2026-05-15): `AppShell.tsx`,
  `ipad-native-presentation.ts`, and their tests were deleted. All platforms
  now lock to `PORTRAIT_UP` via `ScreenOrientation.lockAsync` in `_layout.tsx`.
  `index.tsx` renders screens directly — no intermediate wrapper. Board sizing
  can use `useWindowDimensions()` without accounting for any sidebar offset.
- `Modal visible={true}` used as a full-screen layout wrapper crashes on iPad
  with Fabric (new architecture) — it creates a second UIKit presentation
  context inside an already-managed view. Fixed in `MultiplayerMenuScreen` by
  replacing the Modal wrapper with a plain `<View>`. All other modals
  (`AuctionModal`, `LogModal`, `TradeModal`, `PropertyManager`) use controlled
  `visible` props and are fine.
- `expo-screen-orientation` must appear in the `plugins` array in `app.json`
  for its native iOS module to initialise; omitting it causes silent failures
  when `ScreenOrientation.lockAsync` is called from `_layout.tsx`.
- CI (`.github/workflows/test.yml`) runs `tsc --noEmit` via
  `npm run type-check --workspace=apps/client` before the vitest step. Native
  iOS crashes cannot be caught by the Ubuntu CI runner; only EAS Build or a
  `macos-latest` runner can exercise native code paths.
- Native online multiplayer in `apps/client` cannot rely on browser-only
  `EventSource`; use `online-platform.ts` to select the right local server URL
  (`127.0.0.1` on iOS simulator, `10.0.2.2` on Android emulator) and fall
  back to reconnect polling on native builds.
- In Expo SDK 56 / React Native 0.85, typing issues or other compiler issues may flag `StyleSheet.absoluteFillObject` as missing/non-existent. Always use `StyleSheet.absoluteFill` instead.
- React 19 and ESLint 9 (via `eslint-config-expo`) are highly strict regarding render-phase `useRef` updates (e.g. `Cannot update ref during render` errors) and state updates in `useEffect` (e.g. `react-hooks/set-state-in-effect` errors). To persist modal contents during slide-out transitions and reset state on fresh opens, use standard `useEffect` blocks accompanied by a precise `// eslint-disable-next-line react-hooks/set-state-in-effect` directive explaining _why_ the synchronous sync is required, keeping in mind that ESLint will warn about unused disable comments if they are placed on lines that are not flagged.
