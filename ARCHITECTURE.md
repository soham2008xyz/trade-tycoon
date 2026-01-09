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

## Future Roadmap: Multiplayer

While the current version runs locally, the architecture is designed to scale to online multiplayer.

### Planned Server Architecture

- **Technology Stack:** Node.js (Express) + Socket.io.
- **Role:** The server will act as the authoritative "Source of Truth".
- **State Management:**
  - The `game-logic` package will be shared.
  - The server will hold the canonical `GameState` in memory (or Redis).
  - Client actions (e.g., `ROLL_DICE`) will be sent to the server via WebSocket events.
  - The server will run the reducer: `reducer(serverState, clientAction)`.
  - The new state will be broadcast to all connected clients.

### Data Flow

1. **Client Action:** User clicks "Roll Dice" -> Client emits `socket.emit('action', { type: 'ROLL_DICE', ... })`.
2. **Server Validation:** Server receives event -> Validates turn/rules -> Runs reducer.
3. **State Update:** Server updates its store -> Emits `socket.emit('state_update', newState)`.
4. **Client Sync:** Client receives `newState` -> Replaces local state -> Re-renders UI.

### Implementation Steps

1. Initialize `apps/server` workspace.
2. Setup Socket.io connection handling.
3. Implement room management (Create/Join lobbies).
4. Integrate `game-logic` reducer into the socket event loop.

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
