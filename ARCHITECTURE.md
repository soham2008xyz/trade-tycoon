# Project Architecture

This project is organized as a Monorepo using NPM Workspaces.

## Directory Structure

```text
trade-tycoon/
├── apps/
│   ├── client/          # Expo (React Native) project for Web & Mobile
│   └── server/          # Express server (REST + SSE) for online multiplayer
├── packages/
│   └── game-logic/      # Shared pure TypeScript game engine (rules, state)
├── package.json         # Root configuration
├── ARCHITECTURE.md      # This file
└── DEPLOY.md            # Deployment + env var reference
```

## Workspaces Detail

### 1. `apps/client`

- **Framework:** Expo (React Native).
- **Platform:** Renders to iOS, Android, and Web (`react-native-web`).
- **Responsibility:**
  - UI rendering (board, pieces, cards, game setup).
  - Handling user input.
  - **Local game loop:** imports `game-logic` directly to run the game offline.
  - **Online game loop:** issues REST requests for actions and listens to a
    Server-Sent Events stream for state updates (see `OnlineGame.tsx`).

### 2. `apps/server`

- **Framework:** Node.js + Express.
- **Transport:** REST endpoints under `/api/rooms/*` for client → server, and
  Server-Sent Events at `GET /api/rooms/:id/events` for server → client. There
  is no WebSocket / Socket.IO layer — Vercel serverless does not terminate
  WebSocket connections, so SSE is the supported push primitive.
- **Storage:** Pluggable. Production uses Upstash Redis (`RedisRoomStore`);
  tests and single-process dev use an in-memory map (`InMemoryRoomStore`).
- **Fan-out:** Pluggable. Production uses Redis pub/sub (`RedisEventBus`);
  tests use an in-memory bus (`InMemoryEventBus`). Wiring is selected by the
  presence of `REDIS_URL`.

### 3. `packages/game-logic`

- **Framework:** Pure TypeScript (no React, no Node-specific APIs).
- **Responsibility:**
  - Defines the `GameState` and `LobbyState` interfaces.
  - Implements the state machine (`reducer(state, action) => newState`).
  - Contains all rules: rent calculation, Chance cards, Jail logic, trading
    validation.
- **Usage:** Imported by both the client (for local single-player and to type
  multiplayer payloads) and the server (the authoritative reducer the
  multiplayer server runs).

## Multiplayer data flow

1. **Action.** User clicks "Roll Dice" → client sends
   `POST /api/rooms/:id/actions { userId, action: { type: 'ROLL_DICE', ... } }`.
2. **Validation.** Server checks the room exists, the game has started, the
   user is in the game, and the action's `playerId` matches the authenticated
   user. The server also strips client-provided dice values and rolls its own.
3. **Reduce.** `RoomManager.handleGameAction` runs the shared `gameReducer`
   inside a `RoomStore.update` — an atomic compare-and-swap so two
   simultaneous mutations on the same room can't clobber each other.
4. **Publish.** The router calls `eventBus.publish(roomId, { type: 'game_state_update', state })`.
5. **Fan out.** Redis pub/sub forwards the event to every Vercel function
   instance currently holding an SSE stream open for that room. Each instance
   writes the event to its connected clients.
6. **Render.** The client's `EventSource` receives the event and updates React
   state. UI re-renders.

The same flow applies to lobby mutations (create / join / start), with
`lobby_update` events instead of `game_state_update`.

## Why pluggable backends

The two abstractions — `RoomStore` (state) and `EventBus` (push) — exist so
the server can run identically on three substrates:

| Substrate                            | RoomStore impl      | EventBus impl                      |
| ------------------------------------ | ------------------- | ---------------------------------- |
| Tests + local dev (single Node)      | `InMemoryRoomStore` | `InMemoryEventBus`                 |
| Vercel serverless + Upstash Redis    | `RedisRoomStore`    | `RedisEventBus`                    |
| (Future) any WebSocket-friendly host | `RedisRoomStore`    | a hypothetical `WebSocketEventBus` |

No client-side change is needed when the server's transport changes — the
client only knows about REST + SSE.

## Development guidelines

### Adding a new game feature (e.g. "Auctions")

1. **Logic first (`packages/game-logic`):**
   - Define the `Auction` type in the state.
   - Add a new action type (e.g. `BID_PLACED`).
   - Implement the rules in the reducer.
   - Write unit tests.

2. **Client UI (`apps/client`):**
   - Build the React component (e.g. `AuctionModal.tsx`).
   - Connect to local game state for offline play.
   - For online play, dispatch through `OnlineGame.handleGameDispatch`, which
     POSTs to `/api/rooms/:id/actions`.

3. **Server (`apps/server`):**
   - Usually no work needed — the action goes through `gameReducer` like every
     other action. Add validation only if the new action has special
     authorization rules (e.g. only the host can do it).

### Styling

- Use `StyleSheet.create` from `react-native`.
- Ensure responsiveness using Flexbox.
- Constants for colors and dimensions should be stored in a shared config or
  theme file.
