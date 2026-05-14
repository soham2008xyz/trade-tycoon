# iPhone Layout — Design

**Date:** 2026-05-15
**Status:** Approved (pre-plan)
**Owner:** Soham

## Problem

The Expo client is currently configured for iPad portrait. `Board.tsx` renders a
square board sized to `min(viewport.width, viewport.height) - 20` and parks the
entire status / action UI inside the board's center hole (the inner 72% × 72%
region between the four 14% corner tiles).

On iPad portrait the center hole is ~600×600pt and comfortably hosts the player
list (up to 8 players), current-player chip, dice, position blurb, and up to
five phase-dependent action buttons.

On iPhone portrait (~390pt wide) the board collapses to roughly 390pt × 390pt.
The center hole becomes ~270×270pt. The same content no longer fits: player
rows truncate, dice and action buttons compete for space, and the edge tiles
are too narrow (~33pt) for their names. The recent commit
(`refactor(client): remove ipad shell wrapper, lock app to portrait`) confirmed
the intent to ship a portrait-only experience, but did not adapt the layout for
the phone form factor.

The goal is to make the game playable and pleasant on iPhone in portrait
without regressing the iPad experience.

## Constraints and decisions

The brainstorming session settled the following:

- **Orientation:** portrait only on phone (matches current global lock). No
  landscape work in this scope.
- **Board visibility:** the board stays on screen at all times. We do not move
  to a card-based / phase-modal shell.
- **Layout shape on phone:** board on top, draggable bottom sheet below.
- **Peek state of the sheet:** action-bar style — all currently-valid phase
  action buttons live in the peek, alongside the current-player chip, dice,
  and position. Dragging the sheet open is reserved for inspecting other
  players' state, the log, and the property manager.
- **Layout selection:** width-based. Phone layout activates when
  `min(viewport.width, viewport.height) < 600pt`. Covers iPhone portrait,
  small Android phones, narrow web windows, and iPad split-view.
- **Modals on phone:** full-screen takeover with a header close button. iPad
  / wide-web keeps current centered-overlay sizing.
- **Tile readability:** edge tiles in compact mode show color strip + price
  only. Names appear in `TileInfoModal` on tap (wiring already exists).
- **Library:** `@gorhom/bottom-sheet` for the sheet. Already-installed peers
  (`react-native-gesture-handler`, `react-native-reanimated`,
  `react-native-safe-area-context`) make this a free addition.

## Architecture

### Layout selection

A new hook `useGameLayout()` (in `apps/client/hooks/`) reads
`useWindowDimensions()` and returns `'phone' | 'tablet'`:

```ts
export function useGameLayout(): 'phone' | 'tablet' {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) < 600 ? 'phone' : 'tablet';
}
```

Consumers conditionally render `PhoneGameLayout` or `TabletGameLayout`. The
hook intentionally returns a coarse two-value enum rather than raw dimensions
so callers don't drift toward ad-hoc breakpoints.

### Layout composition

```text
GameUI
└─ useGameLayout()
   ├─ TabletGameLayout         (current behaviour)
   │  └─ Board (with embedded StatusPanel via slot)
   └─ PhoneGameLayout          (new)
      ├─ Board (compact tiles, empty center)
      └─ BottomSheet
         ├─ peek:     StatusPanel.Peek
         └─ expanded: StatusPanel.Expanded
```

`Board` is reduced to the geometric grid (four corners, four edge rows, one
center slot). It no longer knows about player turns, dice phase, or action
button enablement. Its props collapse to: `players`, `boardSize`, `compact`,
`onTilePress`, `slot` (a React node to drop in the center). Player token
animations stay where they are — they are positional and unaffected.

### New components

| Component                  | Responsibility                                             | Location                                              |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| `useGameLayout`            | Returns `'phone' \| 'tablet'` based on window size         | `apps/client/hooks/useGameLayout.ts`                  |
| `StatusPanel.Peek`         | Current player chip, dice, position, action buttons        | `apps/client/components/StatusPanel/Peek.tsx`         |
| `StatusPanel.Expanded`     | Full player list with per-player Trade, Restart, Log       | `apps/client/components/StatusPanel/Expanded.tsx`     |
| `StatusPanel.TabletCenter` | Existing center-hole UI extracted from `Board.tsx`         | `apps/client/components/StatusPanel/TabletCenter.tsx` |
| `PhoneGameLayout`          | Board on top + `BottomSheet` with peek/expanded snaps      | `apps/client/components/layouts/PhoneGameLayout.tsx`  |
| `TabletGameLayout`         | Current center-hole composition                            | `apps/client/components/layouts/TabletGameLayout.tsx` |
| `Tile` (extended)          | New `compact` prop — edge tiles render without name        | `apps/client/components/Tile.tsx`                     |
| `FullScreenModalShell`     | Phone-aware modal wrapper (full screen + close header)     | `apps/client/components/ui/FullScreenModalShell.tsx`  |
| `useStatusPanelActions`    | Given `(state, myPlayerId)`, returns enabled phase actions | `apps/client/hooks/useStatusPanelActions.ts`          |

`StatusPanel.Peek`, `StatusPanel.Expanded`, and `StatusPanel.TabletCenter`
share the same `StatusPanelProps` so the action-button enablement logic
(`canBuy`, `canAuction`, `doublesCount`, jail state, etc.) lives in one place.
That logic currently sits in `GameUI.tsx` and `Board.tsx`; it moves into a
single `useStatusPanelActions(state, myPlayerId)` hook.

### Refactor of `Board.tsx`

`Board.tsx` is ~660 lines and mixes four concerns: tile geometry, player
tokens, status panel, and modal orchestration (PropertyManager / TileInfo /
AuctionModal / TradeModal). For this work we extract:

- Status panel → `StatusPanel.TabletCenter` (verbatim relocation).
- Modal orchestration (TradeModal, PropertyManager, TileInfoModal,
  AuctionModal openers) → stays in `GameUI` since it is layout-agnostic.

`Board` becomes a pure board grid + token renderer + center slot. This makes
both `PhoneGameLayout` and `TabletGameLayout` thin compositions.

### BottomSheet

Add `@gorhom/bottom-sheet` to `apps/client/package.json`. Two snap points:

- `peek` — minimum height to fit `StatusPanel.Peek` content; computed from
  `onLayout` so it shrinks during the roll phase (one button) and grows
  during the action phase (up to four buttons).
- `expanded` — `85%` of screen height, scrollable internally.

The sheet is non-dismissible (no fully-collapsed state). Drag handle visible
in peek. `enablePanDownToClose={false}`.

### Compact tiles

`Tile` gains a `compact?: boolean` prop. When `true`:

- Edge tiles render: color group strip (top edge for bottom row, etc.),
  price text only, owner-color dot, house/hotel markers. No name.
- Corner tiles render unchanged (they have square room).

Triggered by `boardSize < 500` regardless of layout — guarantees the same
behaviour on a narrow web window as on an iPhone.

### Modals

Introduce `FullScreenModalShell` which on phone renders a full-screen
container with a safe-area-aware header (close-X on the left, optional title
center, optional action right). On tablet it renders a no-op pass-through so
existing centered-overlay styles apply.

Apply to: `PropertyManager`, `TradeModal`, `AuctionModal`, `LogModal`,
`TileInfoModal`. The `AuctionModal` already coexists with the bottom sheet
during the auction phase — it sits above the sheet and the sheet's content
becomes irrelevant for that phase; no special-casing needed beyond z-index.

## Data flow

No changes to the game reducer, the SSE transport, or the multiplayer flow.
This is a pure presentation refactor:

- Same `GameUI` props.
- Same `state` / `onDispatch` plumbing.
- Same modal triggers (`TradeModal`, `PropertyManager`, etc.).
- Same `myPlayerId` / `isMyTurn` semantics.

The only place new state appears is the sheet's snap position, owned by the
sheet ref inside `PhoneGameLayout`.

## Error handling and edge cases

- **Resize across breakpoints** (web, iPad split-view): `useGameLayout` will
  flip and React remounts the layout subtree. State that needs to survive
  this — the open trade target, the open property manager, the selected tile
  for `TileInfoModal` — lives in `GameUI`, not in the layout components, so
  it survives the swap.
- **Keyboard up** (during trade composition on phone): bottom sheet must use
  `keyboardBehavior="interactive"` so it tracks the keyboard rather than
  occluding the input.
- **Auction phase**: `AuctionModal` is full-screen-on-phone (via
  `FullScreenModalShell`). Sheet peek hides via `enableContentPanningGesture`
  off while the auction modal is mounted.
- **Bankruptcy alert**: existing `CustomAlert` is rendered above the sheet —
  no change.
- **8-player game**: expanded sheet is scrollable, so an 8-row player list
  with Trade buttons is fine. Peek shows only the current player.
- **Web client**: gesture handler works on RN-web via
  `react-native-gesture-handler/web`; bottom-sheet behaves like a fixed-pos
  panel with drag — same UX.

## Testing

- **Unit:** `useGameLayout` (returns `'phone'` below 600pt, `'tablet'` at or
  above). `useStatusPanelActions` reducer-like helper (given state, returns
  which buttons are enabled).
- **Component:** snapshot / behaviour tests for `StatusPanel.Peek` per phase
  (roll, action, action-with-doubles, in-jail) using
  React Native Testing Library. Existing `game-feedback.test.ts` pattern
  applies.
- **Integration:** existing `multiplayer-gating.test.ts` and
  `online-platform.test.ts` are layout-agnostic — they should keep passing.
- **Manual:** play a full local-hotseat game on iPhone 15 simulator (390pt)
  and iPad 11" simulator (820pt); confirm orientation lock, sheet peek
  during each phase, modal full-screen takeover, compact tile rendering,
  and trade flow.

## Out of scope

- **iPhone landscape.** Today the app is portrait-locked at the root layout
  for native platforms; that stays.
- **Pre-game screens** (`NewGameScreen`, `GameSetup`, `MultiplayerMenuScreen`).
  These are forms and likely already portrait-friendly; we do a visual
  audit only and file follow-up tasks if needed.
- **iPad layout changes.** The tablet path is preserved as-is.
- **Tile name truncation for owner-color full-bleed rendering**, animation
  polish on the sheet, or haptic feedback on snap. Pure layout scope.
- **Storybook stories** for the new components — desirable but not required
  for this slice.

## Dependencies and risks

- New runtime dependency: `@gorhom/bottom-sheet`. Mature, RN-web compatible,
  no native module beyond peers already installed. Low risk.
- The `Board.tsx` refactor is mechanical but large. Risk: animated player
  tokens depend on `boardSize`. Mitigation: keep token rendering inside
  `Board` and pass `boardSize` from the layout wrapper.
- `useGameLayout` boundary at 600pt could feel wrong on iPad Mini (744pt
  portrait — stays tablet). Acceptable; revisit if user reports.
