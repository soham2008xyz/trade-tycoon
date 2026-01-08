# Project Architecture

This project is organized as a Monorepo using NPM Workspaces.

## Directory Structure

```
trade-tycoon/
├── apps/
│   ├── client/          # Expo (React Native) project for Web & Mobile
│   └── server/          # Node.js + Socket.io server for Multiplayer
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
    - UI Rendering (Board, Pieces, Cards).
    - Handling User Input (Clicks, Taps).
    - managing Audio/Animations.
    - **Offline Mode:** Imports `game-logic` directly to run the game locally.
    - **Online Mode:** Connects to `apps/server` via WebSocket, sending actions and receiving state updates.

### 2. `apps/server`
- **Framework:** Node.js (Express), Socket.io.
- **Responsibility:**
    - Game Room Management (Create, Join, Leave).
    - **Source of Truth:** Validates every move using `game-logic`.
    - Persisting game state (in-memory for MVP, DB later).
    - Broadcasting updates to connected clients.

### 3. `packages/game-logic`
- **Framework:** Pure TypeScript (No React, No Node-specific APIs).
- **Responsibility:**
    - Defines the `GameState` interface.
    - Implements the "State Machine" (e.g., `reducer(state, action) => newState`).
    - Contains all rules: Rent calculation, Chance cards, Jail logic, Trading validation.
    - **Usage:** Imported by both Client (for local play/optimistic UI) and Server (for validation).

## Development Guidelines

### Adding a New Feature (e.g., "Auctions")

1.  **Logic First (`packages/game-logic`):**
    - Define the `Auction` type in the State.
    - Create an Action type (e.g., `BID_PLACED`).
    - Implement the logic in the reducer to handle the bid and determine the winner.
    - Write Unit Tests.

2.  **Server (`apps/server`):**
    - Ensure the socket handler listens for the bid event and calls the logic reducer.
    - Broadcast the new state.

3.  **Client UI (`apps/client`):**
    - Create a React Component (e.g., `AuctionModal.tsx`).
    - Connect it to the game state.
    - Dispatch the `BID_PLACED` action (locally or via socket).

### Styling
- Use `StyleSheet.create` from `react-native`.
- Ensure responsiveness using Flexbox.
- Constants for colors and dimensions should be stored in a shared config or theme file.
