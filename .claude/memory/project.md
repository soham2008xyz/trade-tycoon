# Project Memory

- Redis-backed server tests use `REDIS_TEST_URL`, defaulting to the disposable
  local database `redis://127.0.0.1:6379/15`. They call `FLUSHDB`, never
  `FLUSHALL`, and run test files in sequence so the shared database cannot be
  cleared underneath another suite. Production and test ioredis 6 clients set
  `protocol: 2` to retain the existing RESP2 wire behavior.
- Online multiplayer leave is server-authoritative: `OnlineGame.handleLeave`
  must POST `/api/rooms/:id/leave` before returning to the menu, otherwise the
  departed player remains in the room snapshot and their board marker stays
  visible for other clients.
- Reducer-level `errorMessage` values are part of the user-facing game flow in
  local hotseat play (surfaced through the in-game toast) — prefer setting
  `errorMessage` over silent no-ops when the player needs feedback. Online,
  `errorMessage` is never persisted or broadcast: the server aborts the store
  update and returns it to the acting player only, via the 409 response body
  (`serialize.ts` also strips it from any public state as defense in depth).
- `apps/server` tests execute against the published `@trade-tycoon/game-logic`
  package shape, so the server workspace test script must rebuild
  `packages/game-logic` first or reducer changes can be invisible to server
  tests.
- Any workspace script that resolves `@trade-tycoon/game-logic` must build it
  first, because the package's `main`/`types` point at `dist/`, which is
  gitignored and not produced by `npm install`. That's why `apps/server`
  chains `build:game-logic` into `build`/`test`, and why `apps/client`'s
  `lint` now does too — without it, `import/no-unresolved` fires on all 11
  client components that import game-logic, and the husky pre-commit hook
  fails on a fresh clone. CI masks this because `test.yml` runs
  `npm run build:game-logic` as an explicit step before lint.
- `react-hooks/immutability` does not fire on Reanimated `SharedValue.value`
  writes under the current `eslint-config-expo` ~57 / ESLint 9 / React 19
  setup, so the `// eslint-disable-next-line react-hooks/immutability`
  directives that used to guard `rotation.value` / `scale.value` /
  `visualIndex.value` were removed (2026-10-03) as unused. The explanatory
  comments were kept — they still document that `.value` assignment is
  Reanimated's sanctioned animation API rather than a React state mutation.
  `reportUnusedDisableDirectives` is active, so any new directive must be
  shown to suppress something real or lint warns; don't add one speculatively.
- `expo lint` runs ESLint with `--cache` and
  `--cache-location=apps/client/.expo/cache/eslint/` (`@expo/cli`'s
  `lintAsync.js`, cache on by default, opt out with `expo lint --no-cache`).
  ESLint keys that cache on linted-file contents plus eslint config — **not**
  on build artifacts — so a cache entry recorded while `dist/` was missing
  keeps replaying `import/no-unresolved` errors even after game-logic is
  rebuilt correctly. Debugging tell: bare `npx eslint <file>` passes while
  `expo lint` still fails. Delete `apps/client/.expo/cache/eslint/` to clear
  it; changing `package.json` scripts will not invalidate it.
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
- React 19 and ESLint 9 (via `eslint-config-expo`) are highly strict regarding render-phase `useRef` updates (e.g. `Cannot update ref during render` errors) and state updates in `useEffect` (e.g. `react-hooks/set-state-in-effect` errors). To persist modal contents during slide-out transitions and reset state on fresh opens, use standard `useEffect` blocks accompanied by a precise `// eslint-disable-next-line react-hooks/set-state-in-effect` directive explaining _why_ the synchronous sync is required, keeping in mind that ESLint will warn about unused disable comments if they are placed on lines that are not flagged. The same lint rule also rejects an unconditional `setState` call inside a body-level `useEffect` used purely to reset local state when a prop changes — do the reset during render instead (`if (cond) setX(...)` directly in the component body), which React explicitly allows and doesn't trigger the cascading-render warning.
- SSE cleanup in Express must listen on `res.on('close', ...)`, not
  `req.on('close', ...)`. Since Node 16, `IncomingMessage`'s own `'close'`
  fires when the _request body_ finishes reading — immediately for a GET — not
  when the underlying connection tears down. For a long-lived stream like SSE,
  only the response's `'close'` event reflects an actual client disconnect.
- Client-local UI actions (e.g. dismissing a toast) must never be accepted as
  network game actions in multiplayer: the reducer's `errorMessage`/
  `toastMessage` are shared broadcast state, so if the server let any player
  dispatch a "dismiss" action, one player's dismissal would clear it for
  everyone and trigger a full-state broadcast. The fix is at the network
  boundary validator (`parseGameAction` in game-logic), not the reducer —
  dismissal stays a reducer action for local hotseat play, it's just excluded
  from what the server will parse from an untrusted client.
- Expo SDK 57 apps built with Xcode 27 must enable the iOS scene lifecycle via
  `expo-build-properties` and `ios.enableSceneSupport`; keep that plugin setting
  until the project moves past SDK 57.
- With React Native 0.86 and Reanimated 4, `@gorhom/bottom-sheet` 5.2.14 needs
  the upstream mount-position fallback patch recorded in `patches/`. Fixed
  percentage snap points must also set `enableDynamicSizing={false}` so the
  sheet can mount before its content height has been measured.
- `LobbyState.sessions` (private token → public playerId map) intentionally
  lives in `packages/game-logic`, not the server workspace, even though it's
  auth data rather than a game rule — it rides `LobbyState`'s existing CAS
  atomicity and room TTL as one record instead of needing a second
  synchronized store. Documented as a deliberate scope exception in
  `packages/game-logic/AGENTS.md`, not an oversight.
- Generated room IDs are eight characters from an alphabet that excludes
  `0`, `1`, `I`, `L`, and `O` so players can read and relay codes reliably;
  existing room IDs remain valid because lookup still uses their stored code.
- Server room-lifecycle status-code convention: an invalid/unknown session
  token is `401` on `/actions` and `/events` (the routes that operate on an
  already-established session). `/reconnect` and `/leave` instead always
  report a stale session as `404 session_expired`, never `401` — the client's
  resume flow branches on that exact shape to decide whether to clear
  `localStorage`, so collapsing "room gone" and "token stale" into one 404 is
  intentional, not an inconsistency to "fix" toward 401.
- Dependabot must not bump the Expo-pinned packages (`react`, `react-dom`,
  `@types/react`, `react-native`, the `react-native-*` native modules in
  the root `overrides`, plus major bumps of `expo`/`expo-*`/`@expo/*`, whose major is the SDK number — in-SDK patches are fine). A lone bump (e.g. PR #230, react 19.3.0 on Expo SDK 57) leaves the root `overrides` at the old version, so `npm ci` fails with
  "lock file's react@X does not satisfy react@Y", and it would also split
  `react` from `react-dom`. `.github/dependabot.yml` ignores them; upgrade
  them only as part of an Expo SDK upgrade, updating `overrides` in the same
  change. Likewise `expo-router` 58 alone (PR #226) fails `npm ci` with
  ERESOLVE against SDK 57's `expo-constants`. TypeScript major bumps are also
  ignored: TS 7 (PR #225) crashes `expo lint` with "Cannot read properties of
  undefined (reading 'Intrinsic')" because typescript-eslint can't drive it —
  remove that ignore once typescript-eslint supports TS 7.
  ESLint major bumps are ignored too: ESLint 10 (PR #240) removed
  `context.getFilename()`, and eslint-plugin-react 7.37.x (via
  eslint-config-expo 57/58) still calls it, so `expo lint` dies with
  "Error while loading rule 'react/display-name':
  contextOrFilename.getFilename is not a function". Remove that ignore once
  eslint-plugin-react declares ESLint 10 in its peer range.
  Every Dependabot `ignore` rule must set `update-types`: a name-only ignore
  also suppresses security-update PRs, while `update-types` only filters
  routine version updates. Exact pins in `overrides` ignore
  major/minor/patch; tilde pins ignore major/minor so in-range patches flow.
- Phone layout stacking (#257): `Board`, `Tile` and `PlayerToken` use explicit
  `zIndex` values (10–100+). In `PhoneGameLayout` the sibling `BottomSheet` has
  no stacking of its own by default, so those values painted over the expanded
  sheet (GO/Jail corner tiles and the token stack covered the Players list and
  Trade button). The fix is a `zIndex: 0` wrapper around the board plus a higher
  `zIndex`/`elevation` on the sheet (`containerStyle`/`style`); keep that
  wrapper and don't strip the board's internal `zIndex`es. Verified on iPhone 17
  (Expo Go) with 2 and 6 players; Android `elevation` is untested.
- Safe-area insets (#250): the game screen used to render from y=0, so the board
  sat under the status bar / notch / Dynamic Island on iPhones. expo-router
  already provides `SafeAreaProvider`, but nothing pads the root, so
  `PhoneGameLayout` and `TabletGameLayout` apply `useSafeAreaInsets().top`
  themselves, as `paddingTop` on a wrapper _outside_ the view whose `onLayout`
  sizes the `Board` (`onLayout` reports the border box including padding, so
  padding the measured view would size the board for space it doesn't have).
  The phone wrapper also carries the `zIndex: 0` from #257. Insets are 0 on web.
  Verified on iPhone 17 and 17e (native dev build). `Toast` also uses the inset
  (`top: insets.top + 8`, inline; 8px on web).
- Safe-area in modals (#260): a React Native `Modal` mounts its content in a
  separate native root, so the app's `SafeAreaProvider` isn't an ancestor.
  The native `SafeAreaView` looks up the nearest provider among its native
  ancestors (`findNearestProvider`), finds none, and applies 0 insets. Page
  sheets start below the status bar, which hides it; the `fullScreen` Auction
  modal showed its header under the Dynamic Island. Fix: wrap the modal's
  content in its own `<SafeAreaProvider>` (done in `FullScreenModalShell`).
  A nested provider seeds its insets from the parent context, so children
  don't blank for a frame. Verified on iPhone 17: Auction header clears the
  island; Manage (pageSheet) header didn't shift.
- Game-over UI (#269): bankrupt/departed players are removed from
  `state.players`, so once `state.winner` is set the winner is the only player
  left — there are no "final standings" to list, just the winner's cash and
  property count. `RESET_GAME` is server-issued only, so "New Game" exists in
  hotseat only (`LocalGame` → `setIsSetup(true)`); online can only leave.
  Verified on iPhone 17 (Expo Go) and wide web with a temporary
  `DECLARE_BANKRUPTCY p2` dispatch after `RESET_GAME` in `LocalGame` (the
  Declare Bankruptcy button only appears when cash < 0). Not verified: the
  online path with two simulators. Follow-up fixed in #276:
  `RoomManager.leaveRoom` used to call `removePlayerFromGame` (which bypasses
  the reducer's winner guard), so the winner leaving first emptied
  `gameState.players`, reset `winner` and dropped the room back to lobby —
  still-connected bankrupt players lost the game-over screen. `leaveRoom` now
  leaves `gameState` untouched when `winner` is set (the leaver's session and
  lobby entry are still removed, host reassigned, status stays `'game'`); the
  room is only reset once the last lobby player leaves.
- Bankruptcy creditor (#270): `Player.debtOwedTo?: string` is set by
  `chargePlayer` (reducer.ts) only for player-to-player charges that leave
  money < 0 (rent, COLLECT_FROM_ALL cards) and is cleared centrally by
  `clearSettledDebts` on every `reduceGameAction` result, so new money-moving
  actions need no debt code. Bankruptcy hands assets to the creditor only when
  `money < 0` and the creditor is still in the game; leaving a room
  (`removePlayerFromGame`) never transfers. `delete` the key rather than
  setting `undefined` so states stay JSON-identical across Redis round-trips.
  The unpaid shortfall is deliberately written off (rent already credits the
  owner in full), and buildings are sold to the bank at half price with the
  cash going to the creditor.
- Unmortgage cost (#271): never compute interest with float multiplication —
  `Math.ceil(50 * 1.1)` is 56 because `50 * 1.1 === 55.00000000000001`. Use
  `getUnmortgageCost` (`helpers.ts`, value + `Math.ceil(value / 10)`) from both
  the reducer and `PropertyManager`; `helpers.test.ts` checks it against every
  `mortgageValue` in `BOARD`. Same trap applies to any future "+N%" rule.
- `END_TURN` on an unowned, buyable tile in the `'action'` phase is treated
  as a decline and starts the auction (shared `startAuction` helper with
  `DECLINE_BUY`; turn holder and `doublesCount` are kept). Gotcha: an
  auction nobody wins (everyone concedes) returns to `'action'` with the
  lander still standing on the unowned tile, so without a guard End Turn
  would auction it forever. `GameState.auctionedPropertyId` records the tile
  an auction was already held for; it is cleared by `ROLL_DICE`, `END_TURN`
  and `RESET_GAME`. The `phase === 'action'` guard also stops a player who
  starts a turn on last turn's unsold tile from triggering an auction when
  they end the turn before rolling. `DECLINE_BUY` (the Auction button) can
  still re-auction a tile after a no-sale auction — pre-existing, left alone.
- Get Out of Jail Free cards are tracked per deck in `GameState.jailCardHolders`
  (optional; always read via `resolveJailCardHolders`, which rebuilds it from the
  authoritative `Player.getOutOfJailCards` counts for older rooms and
  count-only fixtures). A held jail card is filtered out of the draw pool, which
  keeps exactly one `rng()` call per card draw — server tests that script rng
  order depend on that. Anything that moves counted cards between players must
  move the matching holder too (details in `packages/game-logic/AGENTS.md`).
- `npm run lint:md` and `npm run format` do **not** cover any dot-directory.
  Both use a `**` glob that skips dotfiles, so `.github/`, `.claude/`,
  `.cursor/`, `.vscode/`, `.kiro/` and `.agents/` are silently unlinted and
  unformatted — verified by planting an MD012 violation in each and confirming
  `markdownlint '**/*.md'` still exits 0, while passing the same file by
  explicit path exits 1. The absence of these dirs from
  `.markdownlintignore` / `.prettierignore` is a red herring: they are never
  reached in the first place, so adding them there would change nothing. Do not
  assume `lint:md` covers all markdown. Lint `.github/` explicitly, or switch
  the globs to `dot: true`. Related: `.github/pull_request_template.md` opens
  with a tied `markdownlint-disable MD041` because MD041 wants an H1 first line
  and fires even behind a leading HTML comment; the reason is inline, per the
  no-unexplained-disables rule.
- Player names follow one rule from `packages/game-logic/src/player-names.ts`:
  trim, cap at `MAX_PLAYER_NAME_LENGTH` (15), and reject names with no visible
  character (`isValidPlayerName` also strips zero-width/format chars like
  U+200B, which `String.trim()` keeps). Local setup, the online connect form
  and `RoomManager` all use it — don't re-inline `.trim().slice(…)`. Name
  `TextInput`s use `limitPlayerNameInput` in `onChangeText`, **not**
  `maxLength`: `maxLength` counts leading spaces toward the cap before the
  value is trimmed, silently eating visible characters.
- Modals wrapped in `FullScreenModalShell` get the shell's own header (title +
  ✕) only on the phone layout; on wide layouts the shell is a bare transparent
  `Modal` and the children draw the backdrop/card. Children therefore branch on
  `useGameLayout() === 'phone'` to drop their legacy title/✕/backdrop (see
  `LogModal`, `TradeModal`); otherwise phone shows two headers and two close
  buttons (#253). Detail lives in `apps/client/AGENTS.md`.
- Player presence (who has gone quiet, #259) lives in its own `PresenceStore`
  (ADR 0012), not in `LobbyState`: native clients poll every 2-5 s, and writing
  that into the room record would be a whole-room CAS write per poll. Never
  touch presence from inside a `bumpedUpdate` mutator (pure, retryable); touch
  after the update returns. Compute disconnection over the _lobby_ roster, not
  `gameState.players` — bankrupt players leave the game roster but stay in the
  room, so a game-roster check would bounce them to the menu client-side and
  hide a bankrupt host who vanishes server-side.
- SSE test pitfall: a frame written as two `res.write` calls can be split
  across chunks (write each frame in one call), and racing `reader.read()`
  against a timer leaves a queued read that swallows the next chunk — use one
  long-lived pump that fills a buffer and have the test sleep and inspect it.

- Jail visibility (#274): `Player.jailTurns` counts completed failed rolls,
  starting at 0 on entry; the third non-doubles roll pays $50 and releases
  immediately, resetting the counter. Display failed rolls used, not an
  upcoming attempt number (which would be wrong after rolling). Reducer
  `toastMessage` already feeds the shared local/online toast surface; keep
  failed-attempt feedback there so it also appears in the Game Log.
  Jail guidance and the held-card action can exceed the phone sheet's 28%
  collapsed height; its jail-only minimum measures Peek, including bottom
  safe-area padding, plus the handle so the controls stay visible.

- Oversized jail Peek (#295 review): measuring a minimum snap height is not
  enough when it exceeds the sheet's 85% cap. Jail panels use one
  `BottomSheetScrollView` for Peek and Expanded; Expanded renders a plain View
  there to avoid nested scrolling. Gorhom enables integrated scrolling at
  the highest snap point, so verify expanding first, then scrolling to the
  final action on short screens and with large text.

- Codacy's parameter-count check treats destructured React props as separate
  parameters (Expanded exceeded the eight-parameter limit after adding
  `scrollable`). Accept one typed props object and destructure inside the
  component to keep its single-object interface explicit.

- Game Log completeness (#255): every `ROLL_DICE` path appends a
  `Rolled X + Y[ (doubles)]` entry before its effect entry (toast text), and
  `END_TURN` logs `Ended their turn.`. Tests that read `logs.at(-1)` still see
  the effect entry, so keep the roll entry first. `MAX_LOGS` is 400 because
  rolls and turn ends roughly doubled log volume.

- Tablet layout (#268): the turn buttons only render when
  `inAction` (not while a token moves), so the centre panel's height changes
  at every step; anchoring to the top is not enough, each control needs a
  reserved slot (min height) in `TabletCenter`. `useWindowDimensions`-style
  sizing hides that `pickLayout` returns "tablet" for landscape desktop web
  too, so decide placement from the measured frame (`board-size.ts`), not
  from the layout name. The in-app browser pane crops an emulated 820x1180
  viewport; measure positions with `getBoundingClientRect` via
  `javascript_tool` instead of reading screenshots.

- Worklets (#268): a plain helper called from a Reanimated worklet must carry
  `'worklet'` itself. Web preview and vitest both pass without it; only the
  iOS simulator shows the error, so always run a token move on native after
  touching `token-position.ts`.

- Tile colour bar (#303): `Tile` puts the bar on the board-facing side of all
  four edges (`FLEX_DIRECTION_BY_ORIENTATION`), so tokens in `token-position.ts`
  always anchor to the outer edge. The top and bottom rows had the bar on the
  outer edge until then, and the old inline comments hid it. If you change the
  bar's side, change the token anchor and `anchorFraction` in
  `token-position.test.ts` together.

- Native session resume (#258): the online session is stored on native via
  `expo-secure-store`. The async read/write/clear live in
  `session-storage.tsx`; `online-session.ts` keeps the pure parse/serialize.
  SecureStore has no sync delete, so every `clearStoredSession` followed by
  `onBack()` awaits the clear; otherwise the menu remounts and offers a stale
  Resume button.

- `expo run:ios` gotchas (#258): with Homebrew Ruby 4, `pod install` crashes
  with `Unicode Normalization not appropriate for ASCII-8BIT` unless
  `LANG=en_US.UTF-8` is set. After `npm install` moves `expo-modules-core`,
  `pod install` refuses until you run
  `pod update ExpoModulesCore ExpoModulesWorklets --no-repo-update` in
  `apps/client/ios`. A missing `apps/server/node_modules/ioredis` (v6) makes
  the API server fail to compile on `protocol: 2`; `npm install` fixes it.

- Codacy (#306): it runs `@typescript-eslint/no-floating-promises`, which the
  local Expo lint config does not. Mark a deliberately unawaited promise with
  `void`; don't drop the operator. It also runs ESLint's core
  `no-unused-vars`, which flags every named parameter in a type signature
  (interface methods, function types), even with a `_` prefix. A new type with
  function members fails the gate; restructure so the type isn't needed (the
  first #306 attempt injected a storage interface and had to be undone).
- Web link previews (#286): the client lives at
  `https://trade-tycoon.sohambanerjee.me`; `trade-tycoon.vercel.app` is someone
  else's app, so never use it as a fallback host. Put head tags only in the
  `<Head>` in `apps/client/app/_layout.tsx`. React 19 also hoists bare `<meta>`
  tags from screens, and mixing the two ships duplicate `description` tags.
  `generate-pwa-assets.js` (run again by `vercel-build`) rewrites every PNG in
  `public/`, not just the one you changed, so restore the ones you didn't mean
  to touch before committing. The og image has its own `generate:og` script
  for that reason.

- Phone landscape (#288, web only): `PhoneGameLayout` puts the status panel
  beside the board when the frame is wider than tall (`isSideBySide` in
  `board-size.ts`). `getBoardSize` floors the board at 320px so a 320px-wide
  portrait phone fills its width; a short frame needs a lower floor (Board's
  `minSize` prop) or the board clips. On react-native-web, `flex: 0` becomes
  `flex: 0 1 0%`, and the 0% basis overrides `width`; use
  `flexGrow: 0, flexShrink: 0, flexBasis: 'auto'` to keep a fixed width.

- Dark mode (#264): chrome colours are tokens in `apps/client/constants/theme.ts`;
  never add a colour literal to a component. Two traps from the conversion: a
  bare `<Text>` renders black (invisible on dark surfaces), and the bottom
  sheet, `TextInput` and navigation card paint white by default. The board and
  tiles are game-semantic and stay light on purpose. `app/+html.tsx` replaces
  the generated web document, so keep its `ScrollViewStyleReset`. Details are
  in `apps/client/AGENTS.md` ("Theming").
