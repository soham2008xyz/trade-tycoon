# iPhone Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the Expo client to render a board + draggable bottom-sheet layout on phones (width-based breakpoint) while preserving the existing iPad center-hole layout.

**Architecture:** Introduce a `useGameLayout` hook that picks `'phone' | 'tablet'`. Extract the status-panel content from `Board.tsx` into a `StatusPanel` family (`Peek`, `Expanded`, `TabletCenter`). Add `PhoneGameLayout` (board on top, `@gorhom/bottom-sheet` below with peek + expanded snaps) and `TabletGameLayout` (current behaviour). Extend `Tile` with a `compact` prop for narrow boards. Wrap the five modals in a `FullScreenModalShell` that becomes full-screen on phone. `GameUI` becomes the layout switch.

**Tech Stack:** Expo / React Native, TypeScript, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `@gorhom/bottom-sheet` (new), vitest for pure-logic tests.

**Spec:** [`docs/superpowers/specs/2026-05-15-iphone-layout-design.md`](../specs/2026-05-15-iphone-layout-design.md)

---

## Conventions

- **Tests:** the project uses vitest for pure-logic tests in `apps/client/components/` and elsewhere; there is no React Native Testing Library. We TDD pure helpers and hooks-as-pure-functions, then build React components on top and verify them manually on simulators. Tests in `hooks/` require updating the `test` script (Task 0).
- **Commits:** follow Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `test`, `docs`) in lower case. Husky runs lint + prettier + tests on commit.
- **Working directory:** all paths are relative to repo root (`/Users/sohambanerjee/Workspaces/Personal/trade-tycoon`).
- **Run tests:** `npm test --workspace=apps/client` for client-only.

---

## File map

| Status | Path                                                  | Responsibility                                 |
| ------ | ----------------------------------------------------- | ---------------------------------------------- |
| modify | `apps/client/package.json`                            | Add `@gorhom/bottom-sheet`, broaden test glob  |
| modify | `apps/client/app/_layout.tsx`                         | Wrap with `GestureHandlerRootView` + provider  |
| create | `apps/client/hooks/useGameLayout.ts`                  | Layout-mode hook + `pickLayout` pure helper    |
| create | `apps/client/hooks/useGameLayout.test.ts`             | Tests for `pickLayout`                         |
| create | `apps/client/hooks/useStatusPanelActions.ts`          | `getStatusPanelActions` pure helper + hook     |
| create | `apps/client/hooks/useStatusPanelActions.test.ts`     | Tests for `getStatusPanelActions`              |
| modify | `apps/client/components/Tile.tsx`                     | Add `compact?: boolean` prop                   |
| create | `apps/client/components/StatusPanel/types.ts`         | Shared `StatusPanelProps`                      |
| create | `apps/client/components/StatusPanel/TabletCenter.tsx` | Verbatim relocation of board's center panel    |
| create | `apps/client/components/StatusPanel/Peek.tsx`         | Sheet peek content                             |
| create | `apps/client/components/StatusPanel/Expanded.tsx`     | Sheet expanded content                         |
| create | `apps/client/components/layouts/TabletGameLayout.tsx` | Tablet composition                             |
| create | `apps/client/components/layouts/PhoneGameLayout.tsx`  | Phone composition with bottom sheet            |
| modify | `apps/client/components/Board.tsx`                    | Drop status panel; add `slot`, `compact` props |
| create | `apps/client/components/ui/FullScreenModalShell.tsx`  | Phone-aware modal wrapper                      |
| modify | `apps/client/components/PropertyManager.tsx`          | Use `FullScreenModalShell`                     |
| modify | `apps/client/components/TradeModal.tsx`               | Use `FullScreenModalShell`                     |
| modify | `apps/client/components/AuctionModal.tsx`             | Use `FullScreenModalShell`                     |
| modify | `apps/client/components/LogModal.tsx`                 | Use `FullScreenModalShell`                     |
| modify | `apps/client/components/TileInfoModal.tsx`            | Use `FullScreenModalShell`                     |
| modify | `apps/client/components/GameUI.tsx`                   | Pick layout via `useGameLayout`                |

---

## Task 0: Broaden the test glob

The `apps/client` `test` script is scoped to `components/`. Tests in `hooks/` need the script to run everywhere under the workspace.

**Files:** Modify `apps/client/package.json`

- [ ] **Step 1: Update the test script**

Replace the existing `"test": "vitest run components"` with:

```json
"test": "vitest run"
```

- [ ] **Step 2: Verify existing tests still run**

Run: `npm test --workspace=apps/client`
Expected: same 19 tests pass (3 files in `components/`).

- [ ] **Step 3: Commit**

```bash
git add apps/client/package.json
git commit -m "chore(client): run vitest from workspace root so hooks tests are picked up"
```

---

## Task 1: Add `@gorhom/bottom-sheet` and wire providers

**Files:**

- Modify: `apps/client/package.json`
- Modify: `apps/client/app/_layout.tsx`

- [ ] **Step 1: Install the dependency**

Run: `npm install @gorhom/bottom-sheet --workspace=apps/client`
Expected: package added; lockfile updated; no peer dependency errors (the library's peer deps — `react-native-reanimated`, `react-native-gesture-handler` — are already installed).

- [ ] **Step 2: Wrap the root layout with the gesture handler root**

`@gorhom/bottom-sheet` requires `GestureHandlerRootView` to be mounted at the app root. Replace the entire body of `apps/client/app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((error) => {
        console.warn('Screen orientation lock failed', error);
      });
    }

    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered: ', registration);
          },
          (registrationError) => {
            console.log('SW registration failed: ', registrationError);
          }
        );
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {Platform.OS === 'web' ? (
        <Head>
          <title>Trade Tycoon</title>
          <link rel="manifest" href="/manifest.json" />
        </Head>
      ) : null}
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/package.json apps/client/package-lock.json apps/client/app/_layout.tsx package-lock.json
git commit -m "feat(client): add @gorhom/bottom-sheet and mount GestureHandlerRootView"
```

(`package-lock.json` paths vary depending on workspaces install layout; stage whichever lockfiles were modified.)

---

## Task 2: `useGameLayout` hook

**Files:**

- Create: `apps/client/hooks/useGameLayout.ts`
- Create: `apps/client/hooks/useGameLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/client/hooks/useGameLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickLayout } from './useGameLayout';

describe('pickLayout', () => {
  it('returns "phone" when the shorter side is below the breakpoint', () => {
    expect(pickLayout(390, 844)).toBe('phone'); // iPhone 14 portrait
    expect(pickLayout(844, 390)).toBe('phone'); // iPhone 14 landscape
    expect(pickLayout(599, 1024)).toBe('phone'); // narrow web window
  });

  it('returns "tablet" when the shorter side is at or above the breakpoint', () => {
    expect(pickLayout(600, 800)).toBe('tablet'); // exactly at breakpoint
    expect(pickLayout(820, 1180)).toBe('tablet'); // iPad portrait
    expect(pickLayout(1024, 1366)).toBe('tablet'); // iPad Pro
  });

  it('treats zero dimensions as phone (safe default while measuring)', () => {
    expect(pickLayout(0, 0)).toBe('phone');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test --workspace=apps/client -- hooks/useGameLayout`
Expected: FAIL — module not found (`./useGameLayout`).

- [ ] **Step 3: Implement the hook**

Create `apps/client/hooks/useGameLayout.ts`:

```ts
import { useWindowDimensions } from 'react-native';

export type GameLayout = 'phone' | 'tablet';

export const LAYOUT_BREAKPOINT = 600;

/**
 * Pure layout selector — exported separately so it's testable without
 * mocking react-native hooks.
 */
export function pickLayout(width: number, height: number): GameLayout {
  return Math.min(width, height) < LAYOUT_BREAKPOINT ? 'phone' : 'tablet';
}

/**
 * Returns the active layout mode for the current viewport. Recomputes on
 * window resize (web, iPad split-view, etc.). Coarse `'phone' | 'tablet'`
 * intentionally — callers should not branch on raw pixel widths.
 */
export function useGameLayout(): GameLayout {
  const { width, height } = useWindowDimensions();
  return pickLayout(width, height);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace=apps/client -- hooks/useGameLayout`
Expected: PASS — three tests.

- [ ] **Step 5: Commit**

```bash
git add apps/client/hooks/useGameLayout.ts apps/client/hooks/useGameLayout.test.ts
git commit -m "feat(client): add useGameLayout hook with width-based phone/tablet selector"
```

---

## Task 3: `useStatusPanelActions` hook

Extract action-button enablement logic that currently lives in `GameUI.tsx` and `Board.tsx` into one pure helper so all three `StatusPanel` variants share it.

**Files:**

- Create: `apps/client/hooks/useStatusPanelActions.ts`
- Create: `apps/client/hooks/useStatusPanelActions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/client/hooks/useStatusPanelActions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '@trade-tycoon/game-logic';
import { getStatusPanelActions } from './useStatusPanelActions';

const player = (id: string, money: number, position = 1, props: string[] = []): Player => ({
  id,
  name: id.toUpperCase(),
  color: '#000',
  money,
  position,
  properties: props,
  houses: {},
  mortgaged: [],
  isInJail: false,
  jailTurns: 0,
  getOutOfJailCards: 0,
  bankrupt: false,
  consecutiveDoubles: 0,
});

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  players: [player('alice', 1500), player('bob', 1500)],
  currentPlayerId: 'alice',
  phase: 'roll',
  dice: [0, 0],
  doublesCount: 0,
  logs: [],
  auction: null,
  activeTrade: null,
  errorMessage: undefined,
  toastMessage: undefined,
  ...overrides,
});

describe('getStatusPanelActions', () => {
  it('marks it the local player turn only when ids match', () => {
    const state = baseState();
    expect(getStatusPanelActions(state, 'alice').isMyTurn).toBe(true);
    expect(getStatusPanelActions(state, 'bob').isMyTurn).toBe(false);
  });

  it('canBuy when on an unowned buyable tile during action phase with enough money', () => {
    // Position 1 = Mediterranean Avenue, price 60, action phase, no owner
    const state = baseState({ phase: 'action' });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(true);
    expect(actions.canAuction).toBe(true);
  });

  it('canAuction stays true even when the player cannot afford', () => {
    const state = baseState({
      phase: 'action',
      players: [player('alice', 10), player('bob', 1500)],
    });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(false);
    expect(actions.canAuction).toBe(true);
  });

  it('canBuy is false when the property is already owned', () => {
    const state = baseState({
      phase: 'action',
      players: [player('alice', 1500, 1, []), player('bob', 1500, 0, ['mediterranean'])],
    });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.canBuy).toBe(false);
    expect(actions.canAuction).toBe(false);
  });

  it('exposes the current player and current tile', () => {
    const state = baseState({ phase: 'action' });
    const actions = getStatusPanelActions(state, 'alice');
    expect(actions.currentPlayer?.id).toBe('alice');
    expect(actions.currentTile?.id).toBe('mediterranean');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test --workspace=apps/client -- hooks/useStatusPanelActions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper and hook**

Create `apps/client/hooks/useStatusPanelActions.ts`:

```ts
import { useMemo } from 'react';
import type { GameState, Player, Tile } from '@trade-tycoon/game-logic';
import { BOARD, isTileBuyable } from '@trade-tycoon/game-logic';

export interface StatusPanelActions {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  currentTile: Tile | null;
  canBuy: boolean;
  canAuction: boolean;
}

/**
 * Pure derivation of which status-panel actions are enabled for the local
 * user. Extracted out of GameUI/Board so the three StatusPanel variants
 * (Peek, Expanded, TabletCenter) share one source of truth.
 */
export function getStatusPanelActions(state: GameState, myPlayerId: string): StatusPanelActions {
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;
  const isMyTurn = state.currentPlayerId === myPlayerId;

  const isPropertyUnowned =
    state.phase === 'action' &&
    !!currentPlayer &&
    !!currentTile &&
    isTileBuyable(currentTile) &&
    !state.players.some((p) => p.properties.includes(currentTile.id));

  const canAfford =
    !!currentPlayer && !!currentTile ? currentPlayer.money >= (currentTile.price || 0) : false;

  return {
    isMyTurn,
    currentPlayer,
    currentTile,
    canBuy: isPropertyUnowned && canAfford,
    canAuction: isPropertyUnowned,
  };
}

export function useStatusPanelActions(state: GameState, myPlayerId: string): StatusPanelActions {
  return useMemo(() => getStatusPanelActions(state, myPlayerId), [state, myPlayerId]);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace=apps/client -- hooks/useStatusPanelActions`
Expected: PASS — five tests.

- [ ] **Step 5: Commit**

```bash
git add apps/client/hooks/useStatusPanelActions.ts apps/client/hooks/useStatusPanelActions.test.ts
git commit -m "feat(client): add useStatusPanelActions to centralize phase-action enablement"
```

---

## Task 4: Shared `StatusPanelProps`

A single props shape used by all three `StatusPanel` variants so the three layouts share callbacks and the action derivation.

**Files:**

- Create: `apps/client/components/StatusPanel/types.ts`

- [ ] **Step 1: Create the file**

```ts
import type { GameState, Player, Tile, TradeOffer } from '@trade-tycoon/game-logic';

export interface StatusPanelProps {
  state: GameState;
  myPlayerId: string;
  isMultiplayer: boolean;

  onRoll: () => void;
  onBuy: () => void;
  onDeclineBuy: () => void;
  onEndTurn: () => void;
  onRollAgain: () => void;
  onPayFine: () => void;
  onUseGOOJCard: () => void;
  onDeclareBankruptcy: () => void;
  onShowLog: () => void;
  onRestart: () => void;
  onOpenPropertyManager: () => void;
  onOpenTrade: (targetPlayerId: string) => void;

  /**
   * Indicates a player token is currently animating across the board — we
   * hide the action buttons during travel so the user can't dispatch a
   * follow-up action before the previous one has visually settled.
   */
  isTokenMoving: boolean;
}

export type { GameState, Player, Tile, TradeOffer };
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/components/StatusPanel/types.ts
git commit -m "feat(client): add shared StatusPanelProps for the upcoming panel variants"
```

---

## Task 5: Extract `StatusPanel.TabletCenter` from `Board.tsx`

Verbatim relocation. Behavior must not change. We move the `<View style={styles.center}>` block out of `Board.tsx` into a new component that consumes `StatusPanelProps`.

**Files:**

- Create: `apps/client/components/StatusPanel/TabletCenter.tsx`
- Modify: `apps/client/components/Board.tsx`

- [ ] **Step 1: Create `TabletCenter.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GROUP_COLORS } from '../../constants';
import { IconButton } from '../ui/IconButton';
import { Dice } from '../Dice';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

export const TabletCenter: React.FC<StatusPanelProps> = ({
  state,
  myPlayerId,
  onRoll,
  onBuy,
  onDeclineBuy,
  onEndTurn,
  onRollAgain,
  onPayFine,
  onUseGOOJCard,
  onDeclareBankruptcy,
  onShowLog,
  onRestart,
  onOpenPropertyManager,
  onOpenTrade,
  isTokenMoving,
}) => {
  const { isMyTurn, currentPlayer, currentTile, canBuy, canAuction } = useStatusPanelActions(
    state,
    myPlayerId
  );
  const selfId = myPlayerId;

  if (!currentPlayer) return null;

  return (
    <View style={styles.root}>
      <View style={styles.topButtons}>
        <IconButton title="Restart" icon="restart" onPress={onRestart} color="#666" size="small" />
        <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
      </View>

      <View style={styles.statusPanel}>
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          {state.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                <Text
                  style={[
                    styles.playerText,
                    currentPlayer.id === player.id && styles.activePlayerText,
                  ]}
                >
                  {player.name} (${player.money})
                </Text>
              </View>
              <View
                style={{ marginLeft: 10, opacity: player.id !== selfId ? 1 : 0 }}
                pointerEvents={player.id !== selfId ? 'auto' : 'none'}
              >
                <IconButton
                  title="Trade"
                  icon="handshake"
                  onPress={() => onOpenTrade(player.id)}
                  size="small"
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.gameInfo}>
          <View style={styles.currentPlayerInfo}>
            <Text style={styles.statusText}>Current: </Text>
            <View style={[styles.playerColor, { backgroundColor: currentPlayer.color }]} />
            <Text style={styles.statusText}>{currentPlayer.name}</Text>
          </View>
          <View style={styles.currentTileInfo}>
            <Text style={styles.statusText}>Position: </Text>
            {!isTokenMoving && currentTile?.group && GROUP_COLORS[currentTile.group] && (
              <View
                style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]}
              />
            )}
            <Text style={styles.statusText}>{isTokenMoving ? '...' : currentTile?.name}</Text>
          </View>
          {state.phase === 'action' && (
            <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
          )}
        </View>

        <View style={styles.actions}>
          {isMyTurn ? (
            <>
              {state.phase === 'roll' && (
                <>
                  <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />
                  {currentPlayer.isInJail && (
                    <>
                      <IconButton
                        title="Pay Fine ($50)"
                        icon="cash-remove"
                        onPress={onPayFine}
                        disabled={currentPlayer.money < 50}
                        color="#d9534f"
                      />
                      {currentPlayer.getOutOfJailCards > 0 && (
                        <IconButton
                          title={`Use Card (${currentPlayer.getOutOfJailCards})`}
                          icon="card-account-details"
                          onPress={onUseGOOJCard}
                          color="#5bc0de"
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {currentPlayer.money < 0 && (
                <IconButton
                  title="Declare Bankruptcy"
                  icon="alert-circle"
                  onPress={onDeclareBankruptcy}
                  color="#444"
                />
              )}

              {state.phase === 'action' && (
                <>
                  {canBuy && !isTokenMoving && (
                    <IconButton
                      title={`Buy ($${currentTile?.price || 0})`}
                      icon="cart"
                      onPress={onBuy}
                    />
                  )}
                  {canAuction && !isTokenMoving && (
                    <IconButton
                      title="Auction"
                      icon="gavel"
                      onPress={onDeclineBuy}
                      color="#f0ad4e"
                    />
                  )}
                  {state.doublesCount === 0 && !isTokenMoving && (
                    <IconButton
                      title="Manage Properties"
                      icon="city"
                      onPress={onOpenPropertyManager}
                      color="#841584"
                    />
                  )}
                  {state.doublesCount > 0
                    ? !isTokenMoving && (
                        <IconButton
                          title="Roll Again"
                          icon="dice-multiple"
                          onPress={onRollAgain}
                          color="orange"
                        />
                      )
                    : !isTokenMoving && (
                        <IconButton
                          title="End Turn"
                          icon="check"
                          onPress={onEndTurn}
                          color="#d9534f"
                        />
                      )}
                </>
              )}
            </>
          ) : (
            <Text style={styles.waitingText}>Waiting for {currentPlayer.name} to play…</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { alignItems: 'center', padding: 20 },
  topButtons: { flexDirection: 'row', gap: 10, marginBottom: 10, zIndex: 20 },
  statusPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  playerList: { marginBottom: 15, width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center' },
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2 },
  playerText: { fontSize: 14 },
  activePlayerText: { fontWeight: 'bold' },
  gameInfo: { marginBottom: 15, alignItems: 'center', gap: 4 },
  currentPlayerInfo: { flexDirection: 'row', alignItems: 'center' },
  currentTileInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 14 },
  tileColor: { width: 12, height: 12, marginRight: 6, borderWidth: 1, borderColor: '#333' },
  actions: { gap: 8, width: '100%' },
  waitingText: {
    color: '#aab8c2',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors. (`Board.tsx` still owns the original block — that's fine for this step.)

- [ ] **Step 3: Commit**

```bash
git add apps/client/components/StatusPanel/TabletCenter.tsx
git commit -m "feat(client): add StatusPanel.TabletCenter (extraction prep, not wired yet)"
```

---

## Task 6: `StatusPanel.Peek` (sheet peek content)

Compact horizontal strip: current-player chip + dice + position + currently-valid phase action buttons. No player list, no Restart/Log buttons (those live in `Expanded`).

**Files:**

- Create: `apps/client/components/StatusPanel/Peek.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { Dice } from '../Dice';
import { GROUP_COLORS } from '../../constants';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

export const Peek: React.FC<StatusPanelProps> = ({
  state,
  myPlayerId,
  onRoll,
  onBuy,
  onDeclineBuy,
  onEndTurn,
  onRollAgain,
  onPayFine,
  onUseGOOJCard,
  onDeclareBankruptcy,
  onOpenPropertyManager,
  isTokenMoving,
}) => {
  const { isMyTurn, currentPlayer, currentTile, canBuy, canAuction } = useStatusPanelActions(
    state,
    myPlayerId
  );

  if (!currentPlayer) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.playerChip}>
          <View style={[styles.dot, { backgroundColor: currentPlayer.color }]} />
          <Text style={styles.playerName}>{currentPlayer.name}</Text>
          <Text style={styles.money}>${currentPlayer.money}</Text>
        </View>
        {state.phase === 'action' && (
          <Dice value1={state.dice[0]} value2={state.dice[1]} isRolling={isTokenMoving} />
        )}
      </View>

      <View style={styles.positionRow}>
        <Text style={styles.positionLabel}>Position: </Text>
        {!isTokenMoving && currentTile?.group && GROUP_COLORS[currentTile.group] && (
          <View style={[styles.tileColor, { backgroundColor: GROUP_COLORS[currentTile.group] }]} />
        )}
        <Text style={styles.positionText}>{isTokenMoving ? '…' : currentTile?.name}</Text>
      </View>

      <View style={styles.actions}>
        {isMyTurn ? (
          <>
            {state.phase === 'roll' && (
              <>
                <IconButton title="Roll Dice" icon="dice-5" onPress={onRoll} />
                {currentPlayer.isInJail && (
                  <>
                    <IconButton
                      title="Pay Fine ($50)"
                      icon="cash-remove"
                      onPress={onPayFine}
                      disabled={currentPlayer.money < 50}
                      color="#d9534f"
                    />
                    {currentPlayer.getOutOfJailCards > 0 && (
                      <IconButton
                        title={`Use Card (${currentPlayer.getOutOfJailCards})`}
                        icon="card-account-details"
                        onPress={onUseGOOJCard}
                        color="#5bc0de"
                      />
                    )}
                  </>
                )}
              </>
            )}
            {currentPlayer.money < 0 && (
              <IconButton
                title="Declare Bankruptcy"
                icon="alert-circle"
                onPress={onDeclareBankruptcy}
                color="#444"
              />
            )}
            {state.phase === 'action' && (
              <>
                {canBuy && !isTokenMoving && (
                  <IconButton
                    title={`Buy ($${currentTile?.price || 0})`}
                    icon="cart"
                    onPress={onBuy}
                  />
                )}
                {canAuction && !isTokenMoving && (
                  <IconButton title="Auction" icon="gavel" onPress={onDeclineBuy} color="#f0ad4e" />
                )}
                {state.doublesCount === 0 && !isTokenMoving && (
                  <IconButton
                    title="Manage"
                    icon="city"
                    onPress={onOpenPropertyManager}
                    color="#841584"
                  />
                )}
                {state.doublesCount > 0
                  ? !isTokenMoving && (
                      <IconButton
                        title="Roll Again"
                        icon="dice-multiple"
                        onPress={onRollAgain}
                        color="orange"
                      />
                    )
                  : !isTokenMoving && (
                      <IconButton
                        title="End Turn"
                        icon="check"
                        onPress={onEndTurn}
                        color="#d9534f"
                      />
                    )}
              </>
            )}
          </>
        ) : (
          <Text style={styles.waitingText}>Waiting for {currentPlayer.name}…</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: 12, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { fontWeight: '700', fontSize: 14 },
  money: { color: '#666', fontSize: 13 },
  positionRow: { flexDirection: 'row', alignItems: 'center' },
  positionLabel: { fontSize: 12, color: '#666' },
  tileColor: { width: 10, height: 10, marginRight: 4, borderWidth: 1, borderColor: '#333' },
  positionText: { fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waitingText: { color: '#aab8c2', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/components/StatusPanel/Peek.tsx
git commit -m "feat(client): add StatusPanel.Peek for the phone bottom-sheet peek state"
```

---

## Task 7: `StatusPanel.Expanded` (sheet expanded content)

Full player list with per-player Trade buttons, and a Restart / Log row. No action buttons — those live in `Peek`.

**Files:**

- Create: `apps/client/components/StatusPanel/Expanded.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { IconButton } from '../ui/IconButton';
import { useStatusPanelActions } from '../../hooks/useStatusPanelActions';
import type { StatusPanelProps } from './types';

export const Expanded: React.FC<StatusPanelProps> = ({
  state,
  myPlayerId,
  onShowLog,
  onRestart,
  onOpenTrade,
}) => {
  const { currentPlayer } = useStatusPanelActions(state, myPlayerId);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.sectionTitle}>Players</Text>
      {state.players.map((player) => (
        <View key={player.id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <View style={[styles.playerColor, { backgroundColor: player.color }]} />
            <Text
              style={[
                styles.playerText,
                currentPlayer?.id === player.id && styles.activePlayerText,
              ]}
            >
              {player.name} (${player.money})
            </Text>
          </View>
          <View
            style={{ marginLeft: 10, opacity: player.id !== myPlayerId ? 1 : 0 }}
            pointerEvents={player.id !== myPlayerId ? 'auto' : 'none'}
          >
            <IconButton
              title="Trade"
              icon="handshake"
              onPress={() => onOpenTrade(player.id)}
              size="small"
            />
          </View>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <IconButton title="Log" icon="script-text" onPress={onShowLog} color="#666" size="small" />
        <IconButton title="Restart" icon="restart" onPress={onRestart} color="#666" size="small" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 36, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center' },
  playerColor: { width: 12, height: 12, marginRight: 6, borderRadius: 2 },
  playerText: { fontSize: 14 },
  activePlayerText: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  footerRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/components/StatusPanel/Expanded.tsx
git commit -m "feat(client): add StatusPanel.Expanded with full player list and footer controls"
```

---

## Task 8: Extend `Tile` with a `compact` prop

Compact mode applies to **edge** tiles only (orientations: bottom / left / top / right). Corner tiles are unchanged. Compact tiles show the color strip + price + owner dot + house/hotel markers, and drop the tile name.

**Files:**

- Modify: `apps/client/components/Tile.tsx`

- [ ] **Step 1: Add the prop and conditionally drop the name**

In `apps/client/components/Tile.tsx`, update the `Props` interface and the `content` block.

Update the interface (around the top of the file):

```ts
interface Props {
  tile: TileType;
  orientation: 'bottom' | 'left' | 'top' | 'right' | 'corner';
  style?: StyleProp<ViewStyle>;
  owner?: Player;
  onPress?: () => void;
  testID?: string;
  /**
   * When true, edge tiles render without the name text. Used on narrow
   * boards (phone, narrow web window) where 33pt-wide tiles can't fit a
   * readable label. Corners are unaffected.
   */
  compact?: boolean;
}
```

Update the function signature:

```tsx
export const Tile: React.FC<Props> = ({
  tile,
  orientation,
  style,
  owner,
  onPress,
  testID,
  compact = false,
}) => {
```

Replace the existing `<View style={styles.content}>...</View>` block with:

```tsx
<View style={styles.content}>
  {owner && <View style={[styles.ownerIndicator, { backgroundColor: owner.color }]} />}
  {!(compact && orientation !== 'corner') && (
    <Text style={[styles.text, { fontSize: orientation === 'corner' ? 10 : 8 }]}>{tile.name}</Text>
  )}
  {tile.price && <Text style={styles.price}>${tile.price}</Text>}
</View>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: no errors.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm test --workspace=apps/client`
Expected: same passing count as before (no Tile-specific tests; relying on type-check + downstream manual verification).

- [ ] **Step 4: Commit**

```bash
git add apps/client/components/Tile.tsx
git commit -m "feat(client): add compact prop to Tile to drop name on narrow edge tiles"
```

---

## Task 9: Refactor `Board.tsx` — pure grid + token renderer + center slot

Removes the status panel and the modal triggers (TradeModal, PropertyManager, TileInfoModal, AuctionModal) from Board so it can be used by both phone and tablet layouts. The modals move up to `GameUI`. Accept a `slot` prop for the center content and a `compact` prop forwarded to edge tiles.

**Files:**

- Modify: `apps/client/components/Board.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `apps/client/components/Board.tsx` with:

```tsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { BOARD, Player } from '@trade-tycoon/game-logic';
import { Tile } from './Tile';
import { PlayerToken } from './PlayerToken';

const CORNER_SIZE_PCT = 14;
const COMPACT_TILE_THRESHOLD = 500;

interface Props {
  players: Player[];
  /** React node rendered inside the board's center hole. Pass `null` on phone. */
  slot?: React.ReactNode;
  availableWidth?: number;
  availableHeight?: number;
  /** Tile-tap handler. The host (GameUI) opens TileInfoModal. */
  onTilePress: (tileId: string) => void;
  /** Notifies the host when a player token starts/finishes animating. */
  onTokenMovingChange?: (isMoving: boolean) => void;
}

export const Board: React.FC<Props> = ({
  players,
  slot,
  availableWidth,
  availableHeight,
  onTilePress,
  onTokenMovingChange,
}) => {
  const { width, height } = useWindowDimensions();
  const boardWidth = availableWidth ?? width;
  const boardHeight = availableHeight ?? height;
  const size = Math.max(320, Math.min(boardWidth, boardHeight) - 20);
  const compact = size < COMPACT_TILE_THRESHOLD;

  const handleAnimationStart = () => onTokenMovingChange?.(true);
  const handleAnimationComplete = () => onTokenMovingChange?.(false);

  const bottomRow = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((i) => BOARD[i]);
  const leftRow = [19, 18, 17, 16, 15, 14, 13, 12, 11].map((i) => BOARD[i]);
  const topRow = [21, 22, 23, 24, 25, 26, 27, 28, 29].map((i) => BOARD[i]);
  const rightRow = [31, 32, 33, 34, 35, 36, 37, 38, 39].map((i) => BOARD[i]);
  const corners = { go: BOARD[0], jail: BOARD[10], parking: BOARD[20], gotojail: BOARD[30] };
  const getOwner = (tileId: string) => players.find((p) => p.properties.includes(tileId));

  return (
    <View style={[styles.boardContainer, { width: size, height: size }]}>
      <View style={styles.center} pointerEvents="box-none">
        {slot}
      </View>

      {players.map((player, index) => (
        <PlayerToken
          key={player.id}
          player={player}
          boardSize={size}
          index={index}
          onAnimationStart={handleAnimationStart}
          onAnimationComplete={handleAnimationComplete}
        />
      ))}

      <View style={[styles.corner, styles.bottomRight]}>
        <Tile tile={corners.go} orientation="corner" onPress={() => onTilePress(corners.go.id)} />
      </View>
      <View style={[styles.corner, styles.bottomLeft]}>
        <Tile
          tile={corners.jail}
          orientation="corner"
          onPress={() => onTilePress(corners.jail.id)}
        />
      </View>
      <View style={[styles.corner, styles.topLeft]}>
        <Tile
          tile={corners.parking}
          orientation="corner"
          onPress={() => onTilePress(corners.parking.id)}
        />
      </View>
      <View style={[styles.corner, styles.topRight]}>
        <Tile
          tile={corners.gotojail}
          orientation="corner"
          onPress={() => onTilePress(corners.gotojail.id)}
        />
      </View>

      <View style={styles.rowBottom}>
        {bottomRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="bottom"
            owner={getOwner(t.id)}
            onPress={() => onTilePress(t.id)}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.colLeft}>
        {leftRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="left"
            owner={getOwner(t.id)}
            onPress={() => onTilePress(t.id)}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.rowTop}>
        {topRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="top"
            owner={getOwner(t.id)}
            onPress={() => onTilePress(t.id)}
            compact={compact}
          />
        ))}
      </View>
      <View style={styles.colRight}>
        {rightRow.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            orientation="right"
            owner={getOwner(t.id)}
            onPress={() => onTilePress(t.id)}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  boardContainer: {
    backgroundColor: '#CDE6D0',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#000',
  },
  center: {
    position: 'absolute',
    left: `${CORNER_SIZE_PCT}%`,
    top: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  corner: {
    position: 'absolute',
    width: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    zIndex: 10,
  },
  bottomRight: { bottom: 0, right: 0 },
  bottomLeft: { bottom: 0, left: 0 },
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0 },
  rowBottom: {
    position: 'absolute',
    bottom: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  rowTop: {
    position: 'absolute',
    top: 0,
    left: `${CORNER_SIZE_PCT}%`,
    right: `${CORNER_SIZE_PCT}%`,
    height: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'row',
  },
  colLeft: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    left: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column',
  },
  colRight: {
    position: 'absolute',
    top: `${CORNER_SIZE_PCT}%`,
    bottom: `${CORNER_SIZE_PCT}%`,
    right: 0,
    width: `${CORNER_SIZE_PCT}%`,
    flexDirection: 'column',
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: `apps/client/components/GameUI.tsx` will now have type errors because its `<Board>` invocation still uses the old props. That's expected — Task 11 fixes it.

- [ ] **Step 3: Do NOT commit yet**

Leave the working tree dirty. The next two tasks build the layouts that consume the new `Board` API, and Task 11 will rewire `GameUI` to actually use them. We commit at the end of Task 11.

---

## Task 10: Layouts (`TabletGameLayout`, `PhoneGameLayout`)

**Files:**

- Create: `apps/client/components/layouts/TabletGameLayout.tsx`
- Create: `apps/client/components/layouts/PhoneGameLayout.tsx`

### Step set A — TabletGameLayout

- [ ] **Step 1: Create `TabletGameLayout.tsx`**

```tsx
import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Board } from '../Board';
import { TabletCenter } from '../StatusPanel/TabletCenter';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (tileId: string) => void;
  onTokenMovingChange: (isMoving: boolean) => void;
}

export const TabletGameLayout: React.FC<Props> = (props) => {
  const [frame, setFrame] = React.useState<{ width: number; height: number } | null>(null);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Board
        players={props.state.players}
        availableWidth={frame?.width}
        availableHeight={frame?.height}
        onTilePress={props.onTilePress}
        onTokenMovingChange={props.onTokenMovingChange}
        slot={<TabletCenter {...props} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
});
```

### Step set B — PhoneGameLayout

- [ ] **Step 2: Create `PhoneGameLayout.tsx`**

```tsx
import React, { useMemo, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Board } from '../Board';
import { Peek } from '../StatusPanel/Peek';
import { Expanded } from '../StatusPanel/Expanded';
import type { StatusPanelProps } from '../StatusPanel/types';

interface Props extends StatusPanelProps {
  onTilePress: (tileId: string) => void;
  onTokenMovingChange: (isMoving: boolean) => void;
}

export const PhoneGameLayout: React.FC<Props> = (props) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['28%', '85%'], []);
  const [boardFrame, setBoardFrame] = React.useState<{ width: number; height: number } | null>(
    null
  );

  const handleBoardLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setBoardFrame((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.boardArea} onLayout={handleBoardLayout}>
        <Board
          players={props.state.players}
          availableWidth={boardFrame?.width}
          availableHeight={boardFrame?.height}
          onTilePress={props.onTilePress}
          onTokenMovingChange={props.onTokenMovingChange}
          slot={null}
        />
      </View>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        keyboardBehavior="interactive"
      >
        <View style={styles.peek}>
          <Peek {...props} />
        </View>
        <Expanded {...props} />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 10 },
  peek: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
});
```

Note: `28%` is a starting snap; we'll adjust during manual verification if Peek content overflows or wastes space. The plan keeps it as a tuned constant rather than a dynamic height to minimise iteration cost.

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: still errors from `GameUI.tsx` (fixed in Task 11). The new layout files themselves must type-check.

- [ ] **Step 4: Do NOT commit yet** — combined with Task 11.

---

## Task 11: `FullScreenModalShell` + wrap five modals

**Files:**

- Create: `apps/client/components/ui/FullScreenModalShell.tsx`
- Modify: `apps/client/components/PropertyManager.tsx`
- Modify: `apps/client/components/TradeModal.tsx`
- Modify: `apps/client/components/AuctionModal.tsx`
- Modify: `apps/client/components/LogModal.tsx`
- Modify: `apps/client/components/TileInfoModal.tsx`

- [ ] **Step 1: Create `FullScreenModalShell.tsx`**

```tsx
import React from 'react';
import { Modal, StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameLayout } from '../../hooks/useGameLayout';
import { CloseButton } from './CloseButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When false (default true), do not render the close button in the header. */
  showClose?: boolean;
  children: React.ReactNode;
}

/**
 * On phone: full-screen Modal with a safe-area header (close-X + title).
 * On tablet / wide-web: transparent centered Modal — children own their
 * own backdrop styling, matching the existing iPad overlay.
 */
export const FullScreenModalShell: React.FC<Props> = ({
  visible,
  onClose,
  title,
  showClose = true,
  children,
}) => {
  const layout = useGameLayout();

  if (layout === 'phone') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.phoneRoot} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.phoneHeader}>
            {showClose ? <CloseButton onPress={onClose} /> : <View style={styles.headerSpacer} />}
            {title ? <Text style={styles.phoneTitle}>{title}</Text> : null}
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.phoneBody}>{children}</View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {children}
    </Modal>
  );
};

const styles = StyleSheet.create({
  phoneRoot: { flex: 1, backgroundColor: '#fff' },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  phoneTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 32 },
  phoneBody: { flex: 1 },
});
```

- [ ] **Step 2: Refactor `PropertyManager.tsx`**

Replace the outer `<Modal ...> ... </Modal>` with `<FullScreenModalShell visible={visible} onClose={onClose} title="Manage Properties"> ... </FullScreenModalShell>`. Remove the import of `Modal` and the modal-specific backdrop wrapper. Keep the body content (the ScrollView with property groups) unchanged.

Add the import at the top:

```tsx
import { FullScreenModalShell } from './ui/FullScreenModalShell';
```

Remove `Modal` from the `react-native` import. Locate the existing return shape:

```tsx
return (
  <Modal visible={visible} animationType="slide" transparent>
    ...existing backdrop/centering wrapper + content...
  </Modal>
);
```

Replace with:

```tsx
return (
  <FullScreenModalShell visible={visible} onClose={onClose} title="Manage Properties">
    ...existing content, with the tablet backdrop wrapper preserved so iPad overlay still looks the
    same...
  </FullScreenModalShell>
);
```

The tablet-backdrop is whatever the original `<View style={styles.backdrop}><View style={styles.modal}>` block was. Keep it inside `FullScreenModalShell`. On phone, those wrappers will look like padding inside the page-sheet, which is acceptable; on tablet they restore the centered overlay.

- [ ] **Step 3: Repeat the same refactor for the remaining four modals**

Apply the identical pattern to:

- `TradeModal.tsx` — `title="Trade"`
- `AuctionModal.tsx` — `title="Auction"`; pass `showClose={false}` if the modal must stay open for the duration of the auction phase (look at the existing dismissal pattern — if there's no `onClose` from the host, pass `() => {}`)
- `LogModal.tsx` — `title="Game Log"`
- `TileInfoModal.tsx` — `title={tile?.name ?? 'Tile'}`

For each: import `FullScreenModalShell`, drop the raw `Modal` import, replace the outer wrapper. Preserve all interior content (ScrollViews, action buttons, styling).

- [ ] **Step 4: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: errors confined to `GameUI.tsx` (still has the old wiring), if any.

- [ ] **Step 5: Do NOT commit yet** — combined with Task 12.

---

## Task 12: Rewire `GameUI` to pick the layout

`GameUI.tsx` becomes the place that:

1. Picks `'phone' | 'tablet'` via `useGameLayout`.
2. Owns the modal state (`logVisible`, `alertVisible`, `tradeTargetId`, `selectedTileId`, `showPropertyManager`) that used to live in `Board.tsx`.
3. Passes the right callbacks down to the chosen layout.

**Files:**

- Modify: `apps/client/components/GameUI.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `apps/client/components/GameUI.tsx` with:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GameState, GameAction, BOARD, TradeOffer } from '@trade-tycoon/game-logic';
import { Toast } from './ui/Toast';
import { CustomAlert, AlertOptions } from './ui/Alert';
import { LogModal } from './LogModal';
import { TradeModal } from './TradeModal';
import { PropertyManager } from './PropertyManager';
import { TileInfoModal } from './TileInfoModal';
import { AuctionModal } from './AuctionModal';
import { TabletGameLayout } from './layouts/TabletGameLayout';
import { PhoneGameLayout } from './layouts/PhoneGameLayout';
import { useGameLayout } from '../hooks/useGameLayout';
import { getGameFeedback } from './game-feedback';

interface GameUIProps {
  state: GameState;
  currentPlayerId: string;
  onDispatch: (action: GameAction) => void;
  uiToastMessage: string | null;
  setUiToastMessage: (msg: string | null) => void;
  onLeaveGame: () => void;
  isHost?: boolean;
  isMultiplayer?: boolean;
}

export const GameUI: React.FC<GameUIProps> = ({
  state,
  currentPlayerId: myPlayerId,
  onDispatch,
  uiToastMessage,
  setUiToastMessage,
  onLeaveGame,
  isMultiplayer = false,
}) => {
  const layout = useGameLayout();

  const [logVisible, setLogVisible] = React.useState(false);
  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertOptions, setAlertOptions] = React.useState<AlertOptions | null>(null);
  const [tradeTargetId, setTradeTargetId] = React.useState<string | undefined>(undefined);
  const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);
  const [showPropertyManager, setShowPropertyManager] = React.useState(false);
  const [isTokenMoving, setIsTokenMoving] = React.useState(false);

  const showAlert = (title: string, message: string, buttons: AlertOptions['buttons']) => {
    setAlertOptions({ title, message, buttons });
    setAlertVisible(true);
  };

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const selfId = myPlayerId;
  const getOwner = (tileId: string) => state.players.find((p) => p.properties.includes(tileId));

  const handleRoll = () => onDispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
  const handleEndTurn = () => onDispatch({ type: 'END_TURN', playerId: state.currentPlayerId });
  const handleBuy = () => {
    const tile = currentPlayer ? BOARD[currentPlayer.position] : null;
    if (state.currentPlayerId && tile) {
      onDispatch({
        type: 'BUY_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId: tile.id,
      });
    }
  };
  const handleDeclineBuy = () =>
    onDispatch({ type: 'DECLINE_BUY', playerId: state.currentPlayerId });
  const handlePayFine = () => onDispatch({ type: 'PAY_FINE', playerId: state.currentPlayerId });
  const handleUseGOOJ = () =>
    onDispatch({ type: 'USE_GOOJ_CARD', playerId: state.currentPlayerId });
  const handleRollAgain = () => handleRoll();
  const handleBuild = (id: string) =>
    onDispatch({ type: 'BUILD_HOUSE', playerId: state.currentPlayerId, propertyId: id });
  const handleSell = (id: string) =>
    onDispatch({ type: 'SELL_HOUSE', playerId: state.currentPlayerId, propertyId: id });
  const handleMortgage = (id: string) =>
    onDispatch({ type: 'MORTGAGE_PROPERTY', playerId: state.currentPlayerId, propertyId: id });
  const handleUnmortgage = (id: string) =>
    onDispatch({ type: 'UNMORTGAGE_PROPERTY', playerId: state.currentPlayerId, propertyId: id });
  const handleBid = (playerId: string, amount: number) =>
    onDispatch({ type: 'PLACE_BID', playerId, amount });
  const handleConcedeAuction = (playerId: string) =>
    onDispatch({ type: 'CONCEDE_AUCTION', playerId });
  const handleProposeTrade = (target: string, offer: TradeOffer, request: TradeOffer) =>
    onDispatch({
      type: 'PROPOSE_TRADE',
      playerId: myPlayerId,
      targetPlayerId: target,
      offer,
      request,
    });
  const handleAcceptTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      onDispatch({ type: 'ACCEPT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };
  const handleRejectTrade = (tradeId: string) => {
    if (state.activeTrade && state.activeTrade.id === tradeId) {
      onDispatch({ type: 'REJECT_TRADE', playerId: state.activeTrade.targetPlayerId });
    }
  };
  const handleCancelTrade = () => onDispatch({ type: 'CANCEL_TRADE', playerId: myPlayerId });
  const handleDeclareBankruptcy = () => {
    if (myPlayerId) {
      showAlert(
        'Declare Bankruptcy',
        'Are you sure you want to declare bankruptcy? You will be removed from the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => onDispatch({ type: 'DECLARE_BANKRUPTCY', playerId: myPlayerId }),
          },
        ]
      );
    }
  };
  const handleRestart = () => {
    showAlert('Leave Game', 'Are you sure you want to leave/restart the game?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onLeaveGame },
    ]);
  };

  const gameFeedback = getGameFeedback(state);

  const sharedProps = {
    state,
    myPlayerId,
    isMultiplayer,
    onRoll: handleRoll,
    onBuy: handleBuy,
    onDeclineBuy: handleDeclineBuy,
    onEndTurn: handleEndTurn,
    onRollAgain: handleRollAgain,
    onPayFine: handlePayFine,
    onUseGOOJCard: handleUseGOOJ,
    onDeclareBankruptcy: handleDeclareBankruptcy,
    onShowLog: () => setLogVisible(true),
    onRestart: handleRestart,
    onOpenPropertyManager: () => setShowPropertyManager(true),
    onOpenTrade: (target: string) => setTradeTargetId(target),
    isTokenMoving,
    onTilePress: setSelectedTileId,
    onTokenMovingChange: setIsTokenMoving,
  };

  return (
    <View style={styles.container}>
      <LogModal
        visible={logVisible}
        logs={state.logs}
        players={state.players}
        onClose={() => setLogVisible(false)}
      />
      {gameFeedback && (
        <Toast
          message={gameFeedback.message}
          onDismiss={() => onDispatch({ type: gameFeedback.dismissAction })}
        />
      )}
      {uiToastMessage && (
        <Toast message={uiToastMessage} onDismiss={() => setUiToastMessage(null)} />
      )}
      <CustomAlert
        visible={alertVisible}
        options={alertOptions}
        onClose={() => setAlertVisible(false)}
      />

      {layout === 'phone' ? (
        <PhoneGameLayout {...sharedProps} />
      ) : (
        <TabletGameLayout {...sharedProps} />
      )}

      <AuctionModal
        visible={state.phase === 'auction'}
        auction={state.auction || null}
        players={state.players}
        onBid={handleBid}
        onConcede={handleConcedeAuction}
        isMultiplayer={isMultiplayer}
        myPlayerId={myPlayerId}
      />

      {currentPlayer && selfId && (
        <TradeModal
          visible={
            !!tradeTargetId ||
            (!!state.activeTrade &&
              (state.activeTrade.initiatorId === selfId ||
                state.activeTrade.targetPlayerId === selfId))
          }
          players={state.players}
          currentPlayerId={selfId}
          targetPlayerId={tradeTargetId || state.activeTrade?.targetPlayerId}
          activeTrade={state.activeTrade}
          isMultiplayer={isMultiplayer}
          onPropose={(t, o, r) => {
            handleProposeTrade(t, o, r);
            setTradeTargetId(undefined);
          }}
          onAccept={handleAcceptTrade}
          onReject={handleRejectTrade}
          onCancel={(id) => {
            handleCancelTrade();
            setTradeTargetId(undefined);
          }}
          onClose={() => setTradeTargetId(undefined)}
        />
      )}

      {currentPlayer && (
        <PropertyManager
          visible={showPropertyManager}
          player={currentPlayer}
          onClose={() => setShowPropertyManager(false)}
          onBuild={handleBuild}
          onSell={handleSell}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />
      )}

      <TileInfoModal
        visible={!!selectedTileId}
        tile={selectedTileId ? BOARD.find((t) => t.id === selectedTileId) || null : null}
        owner={selectedTileId ? getOwner(selectedTileId) : undefined}
        onClose={() => setSelectedTileId(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', width: '100%', height: '100%' },
});
```

- [ ] **Step 2: Drop the now-unused `boardSize` prop from modal calls**

`AuctionModal`, `TradeModal`, and `PropertyManager` previously received a `boardSize` prop that was forwarded from `Board.tsx`. If any of them still uses that prop, update their props interface to make it optional or remove the usage. Check by searching:

Run: `grep -n "boardSize" apps/client/components/*.tsx`
Expected: only `Board.tsx`-internal usages should remain. Remove the prop from any modal interface that still declares it.

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/client`
Expected: clean.

- [ ] **Step 4: Run all tests**

Run: `npm test --workspace=apps/client`
Expected: 19+ tests pass (the original three plus the new `useGameLayout` and `useStatusPanelActions` tests = 27).

- [ ] **Step 5: Commit Tasks 9–12 together**

```bash
git add apps/client/components/Board.tsx \
        apps/client/components/layouts/ \
        apps/client/components/StatusPanel/ \
        apps/client/components/ui/FullScreenModalShell.tsx \
        apps/client/components/GameUI.tsx \
        apps/client/components/PropertyManager.tsx \
        apps/client/components/TradeModal.tsx \
        apps/client/components/AuctionModal.tsx \
        apps/client/components/LogModal.tsx \
        apps/client/components/TileInfoModal.tsx
git commit -m "feat(client): split board layouts and add phone bottom-sheet shell

board.tsx becomes a pure grid + tokens + center slot; status panel
content moves into StatusPanel.{TabletCenter,Peek,Expanded}; new
PhoneGameLayout puts the board on top and an @gorhom/bottom-sheet
below with a peek (current-player + action buttons) and expanded
(player list + restart/log) snap. TabletGameLayout preserves the
existing center-hole layout. GameUI picks the layout via
useGameLayout. The five game modals now route through
FullScreenModalShell so they take over the screen on phone."
```

---

## Task 13: Manual verification on simulators

This task has no commit — it's the acceptance gate.

- [ ] **Step 1: Launch the iOS simulator (iPhone)**

Run: `npm run ios --workspace=apps/client`
Expected: simulator boots, app launches on a default iPhone (iPhone 15-class device).

- [ ] **Step 2: Walk through the iPhone flow**

Verify in order:

1. New Game → Local Multiplayer → start a 4-player game.
2. Board fills the upper portion. Edge tiles show color strip + price only (no names).
3. Tap any edge tile → `TileInfoModal` slides up full-screen with name and rent details. Close it via the header X.
4. Bottom sheet sits in **peek** state. Confirm current-player chip, dice (during action phase), position blurb, and the right action buttons for each phase: Roll → Buy / Auction / Manage / End Turn.
5. Drag the sheet up → player list visible with per-player Trade button; Restart and Log accessible.
6. Tap Trade on another player → `TradeModal` opens full-screen. Cancel.
7. Roll until landing on Chance/Community Chest → modal appears full-screen.
8. Trigger an auction (decline buying a property) → `AuctionModal` appears full-screen. Place a bid and resolve.
9. Open Property Manager from the sheet → full-screen.
10. End the local-multiplayer game by declaring bankruptcy → winner alert appears.

- [ ] **Step 3: Launch the iPad simulator**

Run: `xcrun simctl boot 'iPad Pro (11-inch) (4th generation)'` then `npm run ios --workspace=apps/client` (or use the simulator menu).
Expected: app launches on iPad portrait.

- [ ] **Step 4: Verify iPad behaviour unchanged**

1. Board fills the screen as before.
2. Status panel renders inside the board's center hole (TabletCenter).
3. Tile names visible on edge tiles.
4. Modals appear as centered overlays (not page-sheet).
5. No bottom sheet visible.

- [ ] **Step 5: Resize the web window**

Run: `npm run web --workspace=apps/client`
Resize browser window from wide (>1024) to narrow (<500).
Expected:

- Wide → tablet layout (center hole UI).
- Narrow → phone layout (board + bottom sheet).
- The flip happens cleanly without losing modal state if any was open.

- [ ] **Step 6: Document any deferred polish**

If anything looks off but isn't a regression (e.g. the 28% snap point feels too tall, sheet animation jitters, compact tile spacing is slightly off), file the items as inline TODO comments tagged `// iphone-polish:` so they can be triaged later. Do NOT commit unrelated polish in this task.

---

## Self-Review

The author of this plan re-read the spec section by section after writing the tasks:

- **Layout selection (width-based 600pt)** → covered by Task 2.
- **Phone layout shape (board + draggable sheet)** → Task 10 step B; Task 12 wires it.
- **Peek state (action-bar)** → Task 6.
- **Expanded state (player list + restart/log)** → Task 7.
- **Tile readability (compact prop, < 500pt threshold)** → Task 8 and Task 9 (`COMPACT_TILE_THRESHOLD`).
- **Full-screen modals on phone** → Task 11.
- **`useGameLayout`, `useStatusPanelActions`** → Tasks 2 and 3.
- **`StatusPanel.TabletCenter` extraction** → Task 5.
- **`Board.tsx` refactor (grid + tokens + slot)** → Task 9.
- **`PhoneGameLayout`, `TabletGameLayout`** → Task 10.
- **Bottom-sheet dependency** → Task 1.
- **No iPad regressions** → Task 13 step 4.
- **Web resize across breakpoint** → Task 13 step 5.

No placeholders, no "implement appropriate X" — every step shows the actual content. Type names are consistent (`StatusPanelProps`, `GameLayout`, `StatusPanelActions`) across tasks. Method names (`onOpenTrade`, `onOpenPropertyManager`, `onTokenMovingChange`) match between the `StatusPanelProps` definition and the consuming components.
