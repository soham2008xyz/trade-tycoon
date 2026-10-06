# `apps/client` — Agent Notes

This file complements the **root `AGENTS.md`**. Read that first for the
project map, cross-cutting architecture invariants, and the "one fact,
one home" rule. This file covers only what's specific to the client
workspace.

> **Memory reminder:** when you discover a new insight, gotcha, or
> convention while working in this workspace, add it to the relevant
> `.claude/memory/` file **and commit that file** alongside your code
> changes. See the root `AGENTS.md` intro for details.

## Layout

```text
app/
  _layout.tsx                 expo-router root (Stack)
  index.tsx                   Top-level screen state machine
components/
  *.tsx                       UI components (React Native)
  multiplayer-gating.ts       Pure visibility predicates (NO React)
  multiplayer-gating.test.ts  vitest tests for the predicates
  held-cards.ts               Pure formatter for the GOOJ-card badge (NO React)
  ui/                         Primitives (IconButton, Toast, …)
hooks/                        Custom hooks
constants/                    Color tables and the like
scripts/                      Build-time PWA / asset generation
```

## File-extension discipline

- **`.tsx`** for components: imports React Native, uses JSX.
- **`.ts`** for pure helpers and gating predicates: must NOT import
  anything from `react`, `react-native`, `expo-*`, or `@expo/*`. The
  vitest setup runs in plain Node — pulling in any of those breaks the
  test environment.

The canonical example is `components/multiplayer-gating.ts` (pure
helpers, tested in node) vs `components/AuctionModal.tsx` (component,
re-exports the helpers for ergonomic imports). Tests import directly
from the `.ts` module, **never** from a `.tsx` file.

## Multiplayer-gating discipline

Every "is this UI element visible to the local user" rule lives in
`components/multiplayer-gating.ts` as a pure predicate, paired with a
unit test in `components/multiplayer-gating.test.ts`. Components import
the predicate; **they do not re-implement the rule.**

When you add a new multi-player UI surface that needs different
visibility in hotseat vs online:

1. Add an exported function to `multiplayer-gating.ts` with full-
   sentence JSDoc explaining the rule and why hotseat and online
   diverge.
2. Add unit tests covering the four standard scenarios: hotseat
   (always visible), multiplayer-as-actor (visible), multiplayer-as-
   other (hidden), missing-id (hidden in multiplayer / visible in
   hotseat).
3. Use the predicate from the component. Pass it whatever data it
   needs (`selfId`, `isMultiplayer`, the relevant slice of state).

This is the only client-side test surface today. Vitest, node env, no
React Testing Library, no jsdom.

## Two patterns for hotseat-vs-online

The client needs different behaviour in **local hotseat play** (one
device, the user passes it between players) and **online multiplayer**
(one browser per user). Two patterns handle this:

### Pattern 1: implicit via `isMyTurn`

For UI tied to **the outer-game active player** (Roll Dice, Buy, End
Turn, Pay Fine, Manage Properties, Bankruptcy):

```ts
const isMyTurn = state.currentPlayerId === myPlayerId;
```

Works in both modes because of how `myPlayerId` is wired upstream:

- `LocalGame` passes `currentPlayerId={state.currentPlayerId}` —
  `isMyTurn` is always `true` during play (the user-at-the-device IS
  the active player).
- `OnlineGame` passes `currentPlayerId={playerId || ''}` — the local
  user's public id (resolved from the session at join/create time),
  not the private `token`. `isMyTurn` is true only on the active
  player's client.

This is the unifying trick. It works as long as the rule maps cleanly
to "is the active outer-game player".

### Pattern 2: explicit via `isMultiplayer`

For UI **not** tied to the outer-game active player:

- **Auction bid/fold**: bidders rotate among auction participants;
  the active outer-game player isn't involved.
- **Trade Accept/Reject/Cancel**: the trade's initiator and target
  may not be the active player.

For these, `isMyTurn` is the wrong question. `OnlineGame` passes
`isMultiplayer={true}` to `GameUI`, which threads it (along with
`myPlayerId`) through `Board` to the modals. The gating predicates
in `multiplayer-gating.ts` then express the rule
(`!isMultiplayer || playerId === myPlayerId`).

When you add a new modal or interactive surface, the question is:
_does this control apply to the outer-game active player?_ If yes,
use Pattern 1. If no, use Pattern 2.

## Modals on `FullScreenModalShell`

On the phone layout the shell draws the only header (title + ✕) and fills
the screen; on wide layouts it is a bare transparent `Modal` and the
children draw their own backdrop and card. So a modal's children must not
render their own title, ✕ or backdrop/card when `useGameLayout() ===
'phone'` — see `LogModal` and `TradeModal` for the pattern. Keep an extra
button only where it means something different from "close" (e.g. cancelling
an in-flight trade proposal). `AuctionModal` is `showClose={false}` and not
covered by this rule.

## Game over

`state.winner` is the single signal. `getStatusPanelActions` returns
`isGameOver` and hides **every** button (including `waiting`) once it is
set, and `Peek` / `TabletCenter` swap their turn UI for `GameOverCard`
(summary in `game-over.ts`; hotseat-only "New Game" rule is
`canStartNewGame` in `multiplayer-gating.ts`). Trade buttons and the
manage/trade modals aren't driven by `buttons`, so `Expanded`,
`TabletCenter` and `GameUI` gate them on game over explicitly — gate any
new post-win-inert surface the same way. The card's "Back to Menu" goes to
the main menu in both modes: online wires it through `GameUI`'s
`onBackToMenu` (→ `OnlineGame`'s `onMainMenu`), separate from mid-game
leave (`onLeaveGame`), which still returns to the multiplayer menu. The
card is in-tree, not a `Modal`: the win usually follows a `CustomAlert`
(a `Modal`) closing, and a second `Modal` presented mid-dismiss can fail
to show on iOS.

## Room sync (SSE + native polling)

Online state arrives via `GET /api/rooms/:id/events?token=...` on web
(SSE) or a version-aware poll on native (no `EventSource`). The
transport logic lives in `components/online-sync.ts`
(`startRoomSync`), a framework-free module unit-tested in the node
environment — `OnlineGame.tsx` only wires its callbacks onto React
state in a `useEffect` keyed on `[roomId, token]`.

- SSE: `addEventListener('lobby_update', ...)` /
  `addEventListener('game_state_update', ...)`, not the generic
  `onmessage`. The browser's `EventSource` **auto-reconnects** on its
  own when the connection drops (e.g. Vercel's 300s timeout) — don't
  hand-roll reconnect logic.
- Native poll: backs off from 2s to 5s while the server's
  `lobby.version` is unchanged, resets to 2s on a real change, and
  stops on a 404 (`onSessionExpired`).
- Presence (`onPresence`): who the server considers disconnected arrives
  as an SSE `presence` event, or as `disconnectedPlayerIds` on every poll
  snapshot. It never moves `version`, so the poll compares it separately —
  a presence-only change must still reach `onPresence` and keeps the fast
  cadence for one more poll. `OnlineGame` holds it in its own state and
  passes it, plus `hostId`, to `GameUI`, which resolves which players the
  local user may remove through `canRemovePlayer` and hands the panels
  plain id lists (`disconnectedPlayerIds`, `removablePlayerIds`).
- The auction modal covers the status panel, so `AuctionModal` renders its
  own badge and Remove button and confirms **inline** — not via
  `CustomAlert`, which is a second `Modal` and can fail to present on iOS
  while the auction `Modal` is up.
- A closed SSE stream needs a session check. A network blip leaves
  `EventSource` CONNECTING and it retries on its own, but a non-200
  reconnect (401 after the host removed an offline player) closes it for
  good with no event to act on. `startRoomSync` therefore asks
  `/reconnect` once `readyState` is CLOSED and calls `onSessionExpired` on
  a 404.
- Connection state (#313): `onConnected()` / `onDisconnected()` report the
  first result a sync sees, then only changes. The first is always reported
  because the sync effect can re-run while the React state still says
  "lost". SSE: `error` means lost, `open` means back. Poll: `status === 0`
  means lost, any other answer (even a 5xx) means the server is reachable.
  `OnlineGame` wraps the game and lobby in `ConnectionStatusProvider`;
  `ConnectionBanner` reads that context and renders nothing while connected.
  It is in flow at the top of each game layout (above the board, never over
  the phone sheet) and in `FullScreenModalShell`, because a `Modal` is a
  separate native root and would hide a banner placed beside the screen
  (an auction cannot be dismissed). `floating` overlays the top edge for the
  lobby and the transparent tablet modal. It uses `role="alert"`; the
  provider announces a loss once.
- Being removed is judged by `wasRemovedFromRoom` on the **lobby** roster,
  never `gameState.players`: a bankrupt player leaves the game roster but
  is still in the room.
- `startRoomSync` returns a `{ stop() }` handle; `OnlineGame` keeps it
  in a ref and calls `stop()` both on effect cleanup and in
  `handleLeave` (before the `/api/rooms/:id/leave` POST, so the
  route's own broadcast can't resurrect state being abandoned).

Adding a new sync case (a new event type, a new poll response field)
belongs in `online-sync.ts` and its `online-sync.test.ts`, not inline
in the component.

## Resume is opt-in (not auto)

`OnlineGame` mounts in one of three modes via `initialMode`:
`'create'`, `'join'`, or `'resume'`. Only `'resume'` reads the
stored session and calls `POST /api/rooms/:id/reconnect`; the
multiplayer menu surfaces a "Resume Game" button when a session is
stored under key `trade_tycoon_session_v2` (shape:
`{ roomId, playerId, token }`, read/written via `session-storage.tsx`),
and that's the only entry point. The session lives in `localStorage`
on web and in the keychain/keystore (`expo-secure-store`) on native,
so it survives the app being killed (#258). The storage calls need
react-native and expo, so they live in `session-storage.tsx`; the pure
encode/decode (and its tests) stays in `online-session.ts` (see
"File-extension discipline" above). The read/write/clear calls are async because
SecureStore is: **await `clearStoredSession` before `onBack()`**, or
the menu remounts, reads the not-yet-deleted session and offers a
stale Resume button. Native needs a rebuild (`expo run:ios`) after
adding a native module like this one; a JS reload alone fails with a
missing `ExpoSecureStore` module. Verified on the iPad Air 11-inch (M4)
simulator (iOS 26.4): kill, relaunch, Resume, then Leave hides Resume; a server restart
(session expired) also returns to the menu without Resume.

**Do not add silent auto-restore on Create/Join intent.** That was
the impersonation bug — a 2nd browser tab with shared localStorage
got routed straight into the host's lobby AS the host. The current
opt-in design is what's correct; the test in
`apps/server/src/routes/rooms.test.ts` covers the
`session_expired` path that backstops the client.

## Platform guards

- `localStorage` is **web-only**. Always wrap reads/writes in
  `if (Platform.OS === 'web') { ... }`. The online session is the one
  thing stored on native too, via `session-storage.tsx` (see "Resume
  is opt-in" above).
- `EventSource` is web-only. `OnlineGame.tsx` guards on
  `typeof EventSource === 'undefined'` before subscribing. Native
  multiplayer uses a reconnect-polling fallback instead, via
  `components/online-platform.ts`, so lobby/game state still refreshes
  on iOS and Android without a browser SSE implementation.

- **Board stacking is contained.** `Board`, `Tile` and `PlayerToken` use
  explicit `zIndex` values (10–100+). In `PhoneGameLayout` the board
  wrapper has `zIndex: 0` and the `BottomSheet` a higher `zIndex` /
  `elevation`, so nothing from the board can paint over the sheet
  (#257). Keep that wrapper when restructuring the layout, and don't
  strip the board's internal `zIndex`es.
- **Safe-area insets are applied per screen, not at the root.** expo-router
  already provides the `SafeAreaProvider`, but nothing pads the root, so
  each game layout applies `useSafeAreaInsets().top` itself (#250). Put the
  inset as `paddingTop` on a wrapper _outside_ the view whose `onLayout`
  sizes the `Board` — `onLayout` reports the border box including padding,
  so padding the measured view would leave the board sized for space it
  doesn't have. Insets are 0 on web, so it's a no-op there. Absolutely
  positioned overlays do the same: `ui/Toast.tsx` sets
  `top: insets.top + 8` inline (not a hard-coded offset) so it clears the
  Dynamic Island / notch and sits 8px from the top on web.
  **Every `Modal` needs its own `SafeAreaProvider`** (#260): a `Modal`'s
  content is a separate native root, so the app's provider is not an
  ancestor and `SafeAreaView` finds none and applies 0 insets. A `pageSheet`
  starts below the status bar and hides this; a `fullScreen` modal (the
  non-dismissable `AuctionModal`) exposes it. `FullScreenModalShell` wraps
  its phone content in one. Verified on the iPhone 17 simulator (iOS 26.4).

- **Screens with text inputs go in `ui/KeyboardAwareScreen`** (#262). It
  adds iOS keyboard avoidance and tap-outside-to-dismiss (native only; on web
  a press handler around inputs would blur a field right after focus). A
  `ScrollView` inside such a screen needs
  `keyboardShouldPersistTaps="handled"` so taps on its buttons still work
  while the keyboard is up. Verified on the iPhone 17 simulator (iOS 26.4).

- **Dynamic Type: board text is capped, panel text scales** (#273). `Tile`
  sets `maxFontSizeMultiplier={1}` because tiles have fixed pixel sizes; any
  new text drawn on the board needs the same. Panel rows that share a line
  with other content let the text shrink (`flexShrink: 1`) or wrap. Verified
  on the iPhone 17 simulator (iOS 26.4) at `accessibility-extra-large` and on
  the iPad (A16) simulator at `extra-extra-large` and
  `accessibility-extra-large`, always from a fresh launch. On iPad the panel
  can still outgrow the board's center hole at accessibility sizes; since
  #268 `TabletCenter` is a `ScrollView`, so it scrolls instead of spilling
  over the tiles. Don't judge layout after changing the text size live with
  `simctl ui content_size`: text nodes that don't re-render keep their old
  measured height and look clipped. Relaunch the app after each change. The
  menu screens don't scroll and are unreachable at
  `accessibility-extra-extra-extra-large`.

- **Tablet layout keeps controls put and tokens off the text** (#268).
  `TabletCenter` is top-aligned and gives each control a fixed slot (dice;
  decision zone for buy/auction, jail options and "waiting"; Manage; one
  roll / roll again / end turn button), so nothing shifts between turn steps.
  Keep a new button inside one of those slots rather than adding a row. On a
  tall frame (iPad portrait) the Players list moves from the board centre to a
  strip under the board; `board-size.ts` (`getPlayerStripHeight`) decides, and
  landscape web keeps it in the centre. Player tokens sit in a free corner of
  their tile (`token-position.ts`, scaled with the board) because the tile
  centre holds the name and price. `Tile` puts the colour bar (and houses) on
  the board-facing side of all four edges (#303), so tokens always go to the
  outer edge, and `PlayerToken` must get the board's inner size
  (minus its 2px border) or tokens drift 3px past the outer tiles. Every
  helper that `token-position.ts` calls from inside a worklet needs its own
  `'worklet'` directive: the web build and vitest ignore a missing one, but
  iOS throws "Tried to synchronously call a Remote Function" on the first
  token move. Verified on the iPad Air 11-inch (M4) simulator (iOS 26.4),
  including the panel scrolling at `accessibility-extra-large`.
  Trade money sliders count steps of `MONEY_STEP` with the last step at the
  exact balance (`trade-money.ts`).

## Theming (dark mode, #264)

Colours for the UI chrome come from the tokens in `constants/theme.ts`
(`lightTheme` / `darkTheme`, picked by the pure `pickTheme`). Components read
them with `useTheme()` (`hooks/useTheme.ts`, a thin wrapper over
`useColorScheme`), build styles with a `createStyles(theme)` factory
instead of a module-level `StyleSheet.create`, and never write a colour
literal. `pickTheme` returns one of two stable objects, so the factory is cheap
and needs no `useMemo`.

- **Map by role, not by value.** `#fff` was both a surface and a button label
  (`onAccent`); `#666` was both secondary text and a neutral button fill
  (`neutralButton`); `#ccc` was a border and the disabled fill (`disabled*`).
- **Every `Text` needs a colour.** A bare `<Text>` is black, which vanishes on a
  dark surface. Give it a `color: theme.textPrimary` style.
- **Game-semantic colours do not theme:** `GROUP_COLORS`, the board felt, tile
  faces and borders, houses/hotels, the mortgage overlay, player colours,
  `PlayerToken` and `Dice`. The board stays light in dark mode. Text drawn on
  the felt must keep a fixed dark colour; the tablet panels that sit over it
  use the `panelScrim` token so themed text stays readable.
- **Modals** call `useTheme()` themselves. A `Modal` is a separate native
  root, but `useColorScheme` reads the system value, so no provider is needed.
- **Things that default to white:** the `@gorhom/bottom-sheet` background and
  handle (`backgroundStyle` / `handleIndicatorStyle` in `PhoneGameLayout`),
  `TextInput` (set `color`, `placeholderTextColor`, `keyboardAppearance`) and
  the navigation card. `app/_layout.tsx` wraps the app in expo-router's
  `ThemeProvider`; light keeps `DefaultTheme` so the menu backdrop is
  unchanged.
- **Web shell.** `app/+html.tsx` replaces the generated HTML document. It
  keeps the default markup and `ScrollViewStyleReset` and adds `color-scheme`
  meta plus a `prefers-color-scheme` body background, so overscroll and the
  first paint are not white. `expo-router/head` tags still land in its
  `<head>`. `public/manifest.json` stays white: a manifest has one colour.
- Add a token to `Theme` (and both themes) rather than a one-off literal; the
  contrast tests in `constants/theme.test.ts` then cover it.
- Verified in the web build with `prefers-color-scheme` dark and light
  (menus, setup, join form, board, trade and log modals, phone sheet).
  Verified on the iPad Air 11-inch (M4) simulator (iOS 26.4) with the
  simulator appearance set to dark and light: menu, setup, board with the
  Players strip, Log modal, and the dark `keyboardAppearance` accessory bar.
  `xcrun simctl ui <udid> appearance dark` switches a running app live. The
  On the iPhone 17 simulator (iOS 26.4): menu, setup, board with the native
  bottom sheet, and the Trade `pageSheet` in dark and light. Android is
  unchecked. A dev build older than #258 crashes on launch with a missing
  `ExpoSecureStore` module; reinstall a newer build rather than debugging it.

## Accessibility (#256)

Screen readers get nothing from colour, icons or an absent label, so meaning
that sighted players read visually needs text. Build that text in a pure
`.ts` helper with a test, as with `tile-labels.ts` (owner, houses, mortgage;
tax tiles are not ownable even though they have a `price`), `dice-labels.ts`
and `held-cards.ts`, then pass it as `accessibilityLabel`.

- `IconButton` labels itself from `title` and hides its glyph; with an empty
  `title` the glyph stays visible to readers, so pass `accessibilityLabel`
  (the Get Out of Jail Free steppers do). `CloseButton` defaults to "Close".
  `Toast` calls `announceForAccessibility` (native) and has `role="alert"`
  (web, where that call does nothing). Put new defaults before `{...props}` so
  callers can override.
- **Toggle rows on web stay `role="button"`.** react-native-web fires Space
  only for buttons, not for `role="checkbox"`, so `TradeModal`'s property rows
  use `aria-pressed` on web and a checkbox with `aria-checked` on native.
- **Use `aria-checked` / `aria-disabled`, not `accessibilityState`.** The web
  build does not turn `accessibilityState` into ARIA attributes, so the state
  would exist on native only. `aria-hidden` is the cross-platform way to hide
  a decorative icon.
- Check on web with `document.querySelectorAll('[role=button]')` and read
  `aria-label` (react-native-web maps role and label). Verified that way; not
  yet run with VoiceOver on a device (the simulator has no VoiceOver, use
  Accessibility Inspector).

## Test command

```sh
npm test --workspace=apps/client
```

Runs vitest against `components/**/*.test.ts(x)` in node env. There
are no jsdom or RTL setups; if you need to test something that
requires either, lift the logic into a pure module first (see
`multiplayer-gating.ts`) and test that.
