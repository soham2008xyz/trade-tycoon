# Monopoly Game Specification

This document tracks the implementation status of features for the Trade Tycoon project, adhering to standard Monopoly rules.

## Legend

- [x] Implemented & Tested
- [ ] Not Implemented
- [~] Partial Implementation / MVP Limitation

## 1. Game Setup

- [x] **Player Registration**: Support for 2-8 players with custom names (via GameSetup modal). Names are trimmed and capped at 15 characters (`MAX_PLAYER_NAME_LENGTH` in game-logic, shared by local setup, the online form and the server); local Start Game is blocked with an error when any name is blank.
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
- [x] **Auctions**: Auction unowned properties if declined by landing player (choosing Auction, or ending the turn without buying).
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
- [x] **One Get Out of Jail Free card per deck**: Chance and Community Chest each contain a single jail card. While a player holds it, that deck never deals it again (`GameState.jailCardHolders` records the holder per deck, so at most two cards are in play). Using it returns it to its deck; trading it keeps it held by the new owner; bankruptcy gives it to the creditor, or back to the deck when the bank inherits or the holder leaves the room.
- [x] **Held cards are visible**: any player holding Get Out of Jail Free cards shows a small card badge (`×N`, with an accessibility label such as "Holds 2 Get Out of Jail Free cards") next to their name in the Players list and in the current-player status (phone and tablet, hotseat and online), so opponents can see counts when weighing trades. Nothing is shown at zero.
- [x] **Tablet layout** (#268): the centre panel is top-aligned with fixed slots so Manage Properties and the turn button stay in one place from roll to end of turn. On a tall screen (iPad portrait) the Players list sits in the band under the board; landscape web keeps it in the centre. Player tokens sit in a free corner of a tile, away from its colour bar, and shrink with the board, so the tile's name and price stay readable (phone and tablet). Trade money sliders move in $10 steps and the last step is the exact balance.
- [x] **Screen-reader labels** (#256): board tiles read name, price, owner, houses/hotel and mortgage ("Boardwalk, $400, owned by Alice, 2 houses"); the dice read their values; icon-only and icon-plus-text buttons have labels and roles; trade property rows are checkboxes with state; toasts are announced. Checked in the web accessibility tree; VoiceOver on a device is still untested.
- [x] **Phone layout in landscape** (#288, web only; native locks to portrait): the status panel sits beside the board instead of in a bottom sheet, and the board shrinks to fit the height, so the whole board and the turn's actions stay on screen.
- [x] **Taxes**:
  - [x] Income Tax (Flat price).
  - [x] Luxury Tax (Flat price).
- [x] **Free Parking**: No action (Standard rules).
- [x] **Jail**:
  - [x] Go to Jail (Landing on space, Card, 3 Doubles).
  - [x] Visible jail state: status panels and Players lists show failed rolls used out of three; board tokens carry a jail marker, while visitors are labelled separately. Jail hints explain the $50 fine on the third non-doubles roll, and failed-roll toasts/logs report the attempt count. The phone jail panel scrolls when its content exceeds the maximum sheet height, keeping controls reachable on short screens and with large text.
  - [x] **Getting Out**:
    - [x] Roll doubles (3 attempts).
    - [x] Pay $50 fine.
    - [x] Use "Get Out of Jail Free" card (returns it to its deck).
  - [x] Force fine payment after 3 failed roll attempts.

## 6. End Game

- [x] **Bankruptcy**:
  - [x] Player explicitly declares bankruptcy via a `DECLARE_BANKRUPTCY` action (triggered when they cannot meet a debt obligation).
  - [x] All assets (properties, buildings, cash) are forfeited to the bank, except when the player is in debt to another player: then the creditor inherits instead.
  - [x] **Creditor tracking**: when a player-to-player payment (rent, or a "collect from every player" card) leaves a balance below $0, that player's `debtOwedTo` records the payee. Bank charges (tax, jail fine, repairs) never set it and never overwrite an existing creditor; a later player payment replaces it. It clears as soon as the balance is back to $0 or above, or the creditor leaves the game.
  - [x] **Bankruptcy to a player**: the creditor receives the bankrupt player's properties and Get Out of Jail Free cards. Mortgaged properties stay mortgaged, and the creditor is charged 10% of each one's mortgage value (rounded up) straight away. The charge is automatic, applies even if it leaves the creditor below $0, and the creditor can lift the mortgage later with `UNMORTGAGE_PROPERTY`. Buildings are sold back to the bank at half price and that cash goes to the creditor, so properties arrive with no buildings.
  - [x] **Unpaid shortfall is written off**: rent is credited to the owner in full when it is charged, so the creditor is not charged anything further for the part the bankrupt player could not cover.
  - [x] Declaring bankruptcy while solvent, over a bank debt, or after the creditor has left the game forfeits everything to the bank. Leaving a room mid-game never transfers assets.
  - [x] Bankrupt player is removed from the game.
- [x] **Winner Declaration**: Last player remaining wins.
- [x] **Game-over screen**: Once a winner exists the status panel (phone peek / tablet board centre) shows a persistent winner card with the winner's name, colour, cash and property count. All turn actions and Trade buttons are hidden. Hotseat offers **New Game** (back to player setup) and **Back to Menu**; online offers **Back to Menu** (leaves the room). The server keeps the finished game for players still in the room even if the winner leaves first.

## 7. Game Log

- [x] **Event Log**: All significant game events (dice rolls and the tile reached, turn ends, purchases, rent payments, card draws, jail, trades, bankruptcies, etc.) are appended to a `logs` array on `GameState`, capped at the 400 most recent entries so a long game's payload and storage stay bounded.
- [x] **Log Viewer**: In-game modal (`LogModal`) displays the full chronological event history with per-player colour coding.

## 8. Online Multiplayer

### 8.1 Room & Lobby

- [x] **Create Room**: Any player can create a new game room and becomes the host. A unique room ID is generated.
- [x] **Join Room**: Players join via room ID. Up to 8 players supported.
- [x] **Lobby State**: Before the game starts, all connected players are shown in a lobby with name, colour, ready status, and host flag.
- [x] **Copy / Share Room Code**: The lobby has a Copy button (`expo-clipboard`) and a Share button (`Share.share`, shown on web only when the browser has the Web Share API) so the host needn't read out or retype the code (#319).
- [x] **Ready Flow**: Each player marks themselves ready; the host can start the game once all players are ready.
- [x] **Host Privileges**: Only the host can start the game.

### 8.2 Live Sync

- [x] **Server-Sent Events (SSE)**: The server pushes `lobby_update` and `game_state_update` events to all room participants over a persistent SSE connection.
- [x] **REST API**: Game actions are submitted as HTTP POST requests to the server, which applies them via the shared `gameReducer` and, on success, broadcasts the new state. Rejected actions are neither persisted nor broadcast — the acting player alone receives the rejection reason via a 409 response.

### 8.2a Disconnected Players

- [x] **Connection-lost banner**: When the client cannot reach the server (failed poll on native, stream error on web), a non-blocking banner says the screen may be out of date and is announced to screen readers. It clears when the server answers again.

- [x] **Presence tracking**: The server records when it last heard from each player (any authenticated request or an open event stream). A player in a running game unheard-from for more than 45 seconds is reported as disconnected, over the `presence` SSE event and the `disconnectedPlayerIds` field of `/reconnect` (native poll).
- [x] **Disconnected badge**: Disconnected players show a "Disconnected" badge in the player list and in the auction participant list, and the status panel reads "Waiting for Bob… (disconnected)" when they hold the turn. The auction modal covers the status panel, so it carries its own inline Remove confirm (an auction stuck on an absent bidder is a soft-lock too).
- [x] **Remove a disconnected player**: The host (or any player, once the host is disconnected too) can remove a disconnected player after a confirmation. They leave the game exactly as if they had left the room (turn passes on, assets go to nobody) and cannot rejoin. A connected player can never be removed; the server enforces this.
- [~] **Known limitation**: A closed _web_ tab can keep looking present for up to ~5 minutes on Vercel, until the SSE function times out. Native is unaffected. Removal is manual only; there is no automatic timeout.

### 8.3 Persistence & Reconnection

- [x] **Session Storage**: The client persists `{ roomId, playerId, token }` (key `trade_tycoon_session_v2`) in `localStorage` on web and in the keychain/keystore via `expo-secure-store` on native so a refresh or app restart can resume the session. `token` is the private credential; `playerId` alone cannot authenticate.
- [x] **Reconnect Endpoint**: On startup the client validates its stored `token` against `/api/rooms/:roomId/reconnect`. If valid, it re-enters the lobby or active game; if the room is gone or the token is stale, the session is cleared gracefully (404 `session_expired`).
- [x] **In-Memory Store**: Default room store keeps all room state in process memory (suitable for single-server deployments).
- [x] **Redis Store**: Optional `RedisRoomStore` + `RedisEventBus` enables multi-instance deployments with shared state and pub/sub event fanout.

### 8.4 Platform Gating

- [x] **Platform Detection**: Online multiplayer is gated by a runtime check (`supportsOnlineEventStream`) that verifies SSE availability on the current platform before surfacing the online option to the user.

## 9. Web

- [x] **Link previews** (#286): The web export's index page carries a `description` tag plus Open Graph and Twitter card tags, so a shared link shows a title, blurb and a 1200x630 image (`public/og-image.png`, built by `npm run generate:og --workspace=apps/client` and committed). The tags use the absolute production host and render on web only. The not-found page carries no tags on purpose: nobody shares a 404 link, and tagging it would need a custom `+html.tsx` document.

## 10. Appearance

- [x] **Dark mode** (#264): The UI follows the system appearance (`userInterfaceStyle: automatic`). Colour tokens in `constants/theme.ts` cover menus, panels, modals, buttons and inputs; the board itself stays light in both modes. The web export sets `color-scheme` and a `prefers-color-scheme` page background (`app/+html.tsx`).
