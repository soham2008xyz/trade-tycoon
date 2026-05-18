# Monopoly Game Specification

This document tracks the implementation status of features for the Trade Tycoon project, adhering to standard Monopoly rules.

## Legend

- [x] Implemented & Tested
- [ ] Not Implemented
- [~] Partial Implementation / MVP Limitation

## 1. Game Setup

- [x] **Player Registration**: Support for 2-8 players with custom names (via GameSetup modal).
- [x] **Token Selection**: Players can select distinct colors/tokens.
- [x] **Starting Balance**: Each player starts with $1500.
- [ ] **Turn Order**: Sequential based on registration order (Randomization not implemented).

## 2. Board & Tokens

- [x] **Standard Board**: 40 distinct spaces (Properties, Railroads, Utilities, Corners, Taxes, Special).
- [x] **Property Groups**: Properties are grouped by color sets.
- [x] **Visuals**: Board rendering with player token positions.

## 3. Gameplay Mechanics

- [x] **Dice Rolling**: 2d6 generation.
- [x] **Token Movement**: Advance token by dice sum.
- [x] **Doubles**:
  - [x] Roll again on doubles.
  - [x] 3 consecutive doubles sends player to Jail.
- [x] **Passing GO**: Collect $200 salary.
- [x] **Turn Management**: Enforce phases (Roll -> Action -> End).

## 4. Property Management

- [x] **Buying**: Buy unowned properties at listed price.
- [x] **Auctions**: Auction unowned properties if declined by landing player.
- [x] **Rent**:
  - [x] Pay rent to owner upon landing.
  - [x] Double rent for complete color sets (unimproved).
  - [x] Railroad/Utility rent calculation logic.
- [x] **Building**:
  - [x] Build Houses (up to 4) on complete color sets.
  - [x] Build Hotels (after 4 houses).
  - [x] **Sell Buildings**: Sell houses/hotels back to the bank at half the purchase price. Hotels revert to 4 houses if house supply allows.
- [x] **Mortgages**:
  - [x] **Action**: Mortgage owned property for 50% of its value during player's turn.
  - [x] **Restriction**: Cannot mortgage if buildings exist on the property (must sell buildings first).
  - [x] **Effect**: No rent can be collected on mortgaged properties.
  - [x] **Visuals**: Mortgaged properties appear visually distinct (e.g., grayed out or flipped).
  - [x] **Unmortgage**: Lift mortgage by paying mortgage value + 10% interest.
- [x] **Trading**:
  - [x] **Offer**: Initiate trade with another player during turn.
  - [x] **Content**: Trade combination of Cash, Properties, and Get Out of Jail Free cards.
  - [x] **Flow**:
    - Propose trade -> Counter-party reviews -> Accept/Decline.
  - [x] **Validation**: Ensure trade is valid (assets owned, sufficient funds).

## 5. Special Spaces & Cards

- [x] **Chance Cards**: Implement standard deck effects (Movement, Money, Jail, etc.).
- [x] **Community Chest**: Implement standard deck effects.
- [x] **Taxes**:
  - [x] Income Tax (Flat price).
  - [x] Luxury Tax (Flat price).
- [x] **Free Parking**: No action (Standard rules).
- [x] **Jail**:
  - [x] Go to Jail (Landing on space, Card, 3 Doubles).
  - [x] **Getting Out**:
    - [x] Roll doubles (3 attempts).
    - [x] Pay $50 fine.
    - [x] Use "Get Out of Jail Free" card.
  - [x] Force fine payment after 3 failed roll attempts.

## 6. End Game

- [x] **Bankruptcy**:
  - [x] Player explicitly declares bankruptcy via a `DECLARE_BANKRUPTCY` action (triggered when they cannot meet a debt obligation).
  - [x] All assets (properties, buildings, cash) are forfeited to the bank. Any debt owed to another player transfers their properties to that player instead.
  - [x] Bankrupt player is removed from the game.
- [x] **Winner Declaration**: Last player remaining wins.

## 7. Game Log

- [x] **Event Log**: All significant game events (purchases, rent payments, card draws, jail, trades, bankruptcies, etc.) are appended to a `logs` array on `GameState`.
- [x] **Log Viewer**: In-game modal (`LogModal`) displays the full chronological event history with per-player colour coding.

## 8. Online Multiplayer

### 8.1 Room & Lobby

- [x] **Create Room**: Any player can create a new game room and becomes the host. A unique room ID is generated.
- [x] **Join Room**: Players join via room ID. Up to 8 players supported.
- [x] **Lobby State**: Before the game starts, all connected players are shown in a lobby with name, colour, ready status, and host flag.
- [x] **Ready Flow**: Each player marks themselves ready; the host can start the game once all players are ready.
- [x] **Host Privileges**: Only the host can start the game.

### 8.2 Live Sync

- [x] **Server-Sent Events (SSE)**: The server pushes `lobby_update` and `game_update` events to all room participants over a persistent SSE connection.
- [x] **REST API**: Game actions are submitted as HTTP POST requests to the server, which applies them via the shared `gameReducer` and broadcasts the new state.

### 8.3 Persistence & Reconnection

- [x] **Session Storage**: The client persists `roomId` + `userId` locally so a refresh or app restart can resume the session.
- [x] **Reconnect Endpoint**: On startup the client validates its stored session against `/api/rooms/:roomId/reconnect`. If valid, it re-enters the lobby or active game; if the room is gone (server restart), the session is cleared gracefully.
- [x] **In-Memory Store**: Default room store keeps all room state in process memory (suitable for single-server deployments).
- [x] **Redis Store**: Optional `RedisRoomStore` + `RedisEventBus` enables multi-instance deployments with shared state and pub/sub event fanout.

### 8.4 Platform Gating

- [x] **Platform Detection**: Online multiplayer is gated by a runtime check (`supportsOnlineEventStream`) that verifies SSE availability on the current platform before surfacing the online option to the user.
