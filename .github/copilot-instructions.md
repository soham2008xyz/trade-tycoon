# Copilot Instructions for Trade Tycoon

Trade Tycoon is a **Monopoly-style trading game** built as an NPM Workspaces monorepo.

## Architecture Overview

```
trade-tycoon/
├── apps/
│   ├── client/          # Expo (React Native) - Web, iOS, Android
│   └── server/          # Node.js (Express/Socket.io) - future multiplayer
├── packages/
│   └── game-logic/      # Pure TypeScript game engine (NO React/Node APIs)
```

### Critical Principle: "Logic First, Client Second"

**All game rules and state mutations MUST live in `packages/game-logic`**. The client only:

- Renders state via React components
- Dispatches actions via `useReducer`
- Never contains game logic

## State Management: Reducer Pattern

The game uses a **strict immutable reducer pattern**:

```typescript
// packages/game-logic/src/reducer.ts
gameReducer(state: GameState, action: Action): GameState

// apps/client/app/index.tsx
const [gameState, dispatch] = useReducer(gameReducer, initialState);
dispatch({ type: 'ROLL_DICE', playerId: currentPlayer.id });
```

Key types defined in `packages/game-logic/src/types.ts`:

- `GameState` - Complete game state (players, board, dice, phase, auction, trades)
- `Player` - Player data (money, position, properties, houses, mortgaged, jail status)
- `Action` - Union type of all game actions (JOIN_GAME, ROLL_DICE, BUY_PROPERTY, etc.)

## Essential Commands

```bash
npm install                                          # Install all dependencies

# Game Logic (run first when changing rules)
npm run test --workspace=packages/game-logic         # Run vitest tests (MANDATORY)
npm run build --workspace=packages/game-logic        # Build for production

# Client
npm run web --workspace=apps/client                  # Start Expo web dev server
npm run lint --workspace=apps/client                 # ESLint check

npm run test                                         # Run all workspace tests
```

## Development Workflow for Features

1. **Modify `packages/game-logic`**:
   - Add types to `src/types.ts`
   - Add action handlers to `src/reducer.ts`
   - **Write tests** in `src/reducer.test.ts` or `src/*.test.ts`
   - Run `npm run test --workspace=packages/game-logic`

2. **Update `apps/client`**:
   - Create/modify components in `components/`
   - Connect to state via props from `app/index.tsx`
   - Dispatch actions to trigger logic

## Key Patterns

### Component Naming

Use **PascalCase** for React component files (e.g., `AuctionModal.tsx`, `TileInfoModal.tsx`, `PropertyManager.tsx`).

### Styling

- Use `StyleSheet.create` from `react-native`
- Ensure cross-platform (iOS/Android/Web) compatibility

## Writing Tests

**Logic features are not complete without passing tests.** Use `vitest` for all `game-logic` tests.

### Test File Structure

Tests are co-located with source files:

- `reducer.test.ts` - Core game actions (rolling, buying, building, mortgages)
- `auction-trade.test.ts` - Auction and trade logic
- `cards.test.ts` - Chance/Community Chest cards

### Test Pattern Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from './reducer';
import { createInitialState, createPlayer } from './index';
import { GameState } from './types';

describe('Feature Name', () => {
  let state: GameState;

  beforeEach(() => {
    // Setup fresh state before each test
    state = createInitialState();
    state.players = [createPlayer('p1', 'Player 1'), createPlayer('p2', 'Player 2')];
    state.currentPlayerId = 'p1';
    state.phase = 'action';
  });

  it('should do something when action dispatched', () => {
    const newState = gameReducer(state, {
      type: 'ACTION_TYPE',
      playerId: 'p1',
      // ... other action params
    });

    expect(newState.someProperty).toBe(expectedValue);
    expect(newState.errorMessage).toBeUndefined(); // Verify no errors
  });

  it('should fail with error if invalid', () => {
    state.players[0].money = 10; // Setup failure condition

    const newState = gameReducer(state, {
      type: 'ACTION_TYPE',
      playerId: 'p1',
    });

    expect(newState.errorMessage).toMatch(/expected error/);
  });
});
```

### Key Testing Patterns

1. **Use `beforeEach`** to reset state for isolation
2. **Test both success and failure paths** - verify `errorMessage` is set on failures
3. **Use `die1`/`die2` params** to control dice for deterministic movement tests
4. **Mock `Math.random`** with `vi.spyOn` for card draw tests:
   ```typescript
   const randomSpy = vi.spyOn(Math, 'random');
   randomSpy.mockReturnValueOnce(0.5); // Control card index
   // ... test ...
   randomSpy.mockRestore();
   ```
5. **Test turn enforcement** - verify actions fail when wrong player attempts them

## Multiplayer Architecture (Planned)

The architecture is designed for future online multiplayer via Socket.io.

### Server Role

- **Authoritative Source of Truth**: Server holds the canonical `GameState`
- **Technology**: Node.js (Express) + Socket.io in `apps/server`
- **State Storage**: In-memory (or Redis for scaling)

### Data Flow

```
┌─────────────┐        WebSocket         ┌─────────────┐
│   Client    │ ──── socket.emit() ───→  │   Server    │
│  (Expo/RN)  │                          │  (Node.js)  │
│             │                          │             │
│  useReducer │ ←── state_update() ────  │  reducer()  │
│  (sync)     │                          │  (authoritative)
└─────────────┘                          └─────────────┘
```

1. **Client Action**: User clicks "Roll Dice" → `socket.emit('action', { type: 'ROLL_DICE', ... })`
2. **Server Validation**: Server validates turn/rules → Runs `gameReducer(serverState, action)`
3. **State Broadcast**: Server emits `socket.emit('state_update', newState)` to all clients
4. **Client Sync**: Clients replace local state → Re-render UI

### Implementation Steps

1. Initialize `apps/server` workspace with Express + Socket.io
2. Setup room management (create/join lobbies)
3. Integrate `@trade-tycoon/game-logic` reducer into socket event loop
4. Handle player disconnection and reconnection

### Shared Logic Advantage

The `packages/game-logic` package is **framework-agnostic**:

- Client imports it for local single-player mode
- Server imports the same package for authoritative multiplayer
- Guarantees identical game rules across environments

## Workspace Boundaries

- **Never edit** `node_modules` or `dist` directories
- Node version: **24** (see `.nvmrc`)
- Package scope: `@trade-tycoon/*`

## Key Files Reference

| Purpose                  | File                                    |
| ------------------------ | --------------------------------------- |
| Game state types         | `packages/game-logic/src/types.ts`      |
| Reducer (all game logic) | `packages/game-logic/src/reducer.ts`    |
| Board data (40 tiles)    | `packages/game-logic/src/board-data.ts` |
| Main game component      | `apps/client/app/index.tsx`             |
| Feature status           | `SPECIFICATION.md`                      |
| Full agent guide         | `AGENTS.md`                             |
