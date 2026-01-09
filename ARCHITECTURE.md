# Project Architecture

This project is organized as a Monorepo using NPM Workspaces.

## Directory Structure

```text
trade-tycoon/
├── apps/
│   └── client/          # Expo (React Native) project for Web & Mobile
├── packages/
│   └── game-logic/      # Shared pure TypeScript game engine (Rules, State)
├── package.json         # Root configuration
└── ARCHITECTURE.md      # This file
```

## Workspaces Detail

### 1. `apps/client`

- **Framework:** Expo (React Native).
- **Platform:** Renders to iOS, Android, and Web (`react-native-web`).
- **Responsibility:**
  - UI Rendering (Board, Pieces, Cards, Game Setup).
  - Handling User Input (Clicks, Taps).
  - **Local Game Loop:** Imports `game-logic` directly to run the game locally.
  - Manages local state using `useReducer` hooked into the game engine.

### 2. `packages/game-logic`

- **Framework:** Pure TypeScript (No React, No Node-specific APIs).
- **Responsibility:**
  - Defines the `GameState` interface.
  - Implements the "State Machine" (e.g., `reducer(state, action) => newState`).
  - Contains all rules: Rent calculation, Chance cards, Jail logic, Trading validation.
  - **Usage:** Imported by Client for local play (and potentially Server for validation in future).

## Development Guidelines

### Adding a New Feature (e.g., "Auctions")

1. **Logic First (`packages/game-logic`):**
   - Define the `Auction` type in the State.
   - Create an Action type (e.g., `BID_PLACED`).
   - Implement the logic in the reducer to handle the bid and determine the winner.
   - Write Unit Tests.

2. **Client UI (`apps/client`):**
   - Create a React Component (e.g., `AuctionModal.tsx`).
   - Connect it to the game state.
   - Dispatch the `BID_PLACED` action.

### Styling

- Use `StyleSheet.create` from `react-native`.
- Ensure responsiveness using Flexbox.
- Constants for colors and dimensions should be stored in a shared config or theme file.
