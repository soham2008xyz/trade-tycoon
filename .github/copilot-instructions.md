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

### Component naming

- Use **lower-case-with-dashes** for all component file names (e.g., `tile-info-modal.tsx`)

### Styling

- Use `StyleSheet.create` from `react-native`
- Ensure cross-platform (iOS/Android/Web) compatibility

### Testing

- **Logic features are not complete without passing tests**
- Use `vitest` for `game-logic` package
- Tests are co-located: `reducer.test.ts`, `auction-trade.test.ts`, `cards.test.ts`

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
