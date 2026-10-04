# Game Logic

`@trade-tycoon/game-logic` is the shared, framework-independent TypeScript rules engine for [Trade Tycoon](../../README.md). It defines the board, players, actions, and state transitions used by both the Expo client (`apps/client`) and the Express multiplayer server (`apps/server`).

The package has no React, React Native, browser, Node-specific, or network dependencies. The client handles rendering and input; the server handles sessions, storage, and transport. Both rely on this package for game rules.

## What it handles

- A 40-tile board with streets, railroads, utilities, taxes, Chance, and Community Chest.
- Turn order, dice rolls, doubles, movement, passing GO, and jail.
- Buying property, auctions, rent, houses/hotels, mortgages, and trades.
- Get Out of Jail Free cards, bankruptcy, creditor transfers, and player removal.
- Player setup, shared colors, lobby types, and validation of incoming game actions.

Game state is updated through a **pure, immutable reducer**: given a state and an action, it produces the next state without modifying the input. Random rolls and card draws can use an injected random-number generator for repeatable tests and server retries.

## Using the package

This repository uses npm workspaces. From the repository root:

```bash
npm install
npm run build --workspace=packages/game-logic
```

The package is imported by its workspace name:

```ts
import { BOARD, createInitialState, gameReducer } from '@trade-tycoon/game-logic';

let state = gameReducer(createInitialState(), {
  type: 'RESET_GAME',
  players: [
    { id: 'alice', name: 'Alice', color: '#FF0000' },
    { id: 'bob', name: 'Bob', color: '#0000FF' },
  ],
});

state = gameReducer(state, {
  type: 'ROLL_DICE',
  playerId: 'alice',
  die1: 2,
  die2: 3,
});

const alice = state.players.find((player) => player.id === 'alice');
const tile = alice ? BOARD[alice.position] : undefined;
console.log(tile?.name);
```

`gameReducer(state, action)` returns a `GameState` and works with React's `useReducer`. The example supplies dice values for clarity; normal rolls can omit `die1` and `die2`.

### Key exports

All public exports come from [`src/index.ts`](./src/index.ts).

| Export | Purpose |
| --- | --- |
| `GameState`, `Player`, `Tile`, `GameAction` | Shared game and action types. |
| `createInitialState`, `createPlayer` | Initialize game and player data. |
| `gameReducer` | Apply an action with a `GameState` return type, suitable for local play. |
| `reduceGameAction`, `ACTION_REJECTED` | Apply actions with explicit hard-rejection signaling for server use. |
| `parseGameAction` | Validate and narrow an untrusted payload into a permitted network action, or return `null`. |
| `BOARD` | Ordered board tiles and their rules data. |
| `CHANCE_CARDS`, `COMMUNITY_CHEST_CARDS` | The two card decks. |
| `mulberry32` | Seedable random-number generator for deterministic execution. |
| `LobbyState`, `LobbyPlayer` | Shared multiplayer room types; these are not network transport implementations. |

Other exported helpers cover property groups, building rules, mortgage costs, player names, and color selection.

### Handling invalid actions

The two reducer entry points have different return contracts:

- **`gameReducer`** converts a hard rejection to the original state so it remains compatible with React's `useReducer`.
- **`reduceGameAction`** can return `ACTION_REJECTED` for a hard rejection. An invalid action may also leave state reference-equal (for example, an out-of-turn action) or return a state with `errorMessage` for player-facing feedback.

The multiplayer server treats all three outcomes as rejected updates: it does not persist or broadcast them, and responds to the acting player with HTTP 409. A separate session check happens before the reducer.

For incoming network payloads, use `parseGameAction(input)` before applying an action. It rejects malformed or unsupported actions; internal actions such as `RESET_GAME` and client-only dismiss actions are not accepted over this boundary.

### Repeatable randomness

`reduceGameAction` accepts an optional third argument, `rng: () => number`:

```ts
import {
  ACTION_REJECTED,
  mulberry32,
  reduceGameAction,
} from '@trade-tycoon/game-logic';

const next = reduceGameAction(
  state,
  { type: 'ROLL_DICE', playerId: state.currentPlayerId },
  mulberry32(42)
);

if (next !== ACTION_REJECTED) {
  state = next;
}
```

For a retryable store operation, recreate the generator from the **same seed on each attempt**, rather than reusing a generator whose state has advanced.

## Source layout

| File | Responsibility |
| --- | --- |
| [`types.ts`](./src/types.ts) | Game state, players, tiles, trades, auctions, and action types. |
| [`reducer.ts`](./src/reducer.ts) | Rules and game state transitions. |
| [`game-setup.ts`](./src/game-setup.ts) | Initial game and player state. |
| [`board-data.ts`](./src/board-data.ts) | Board layout and tile values. |
| [`cards.ts`](./src/cards.ts), [`chance-cards.ts`](./src/chance-cards.ts), [`community-chest-cards.ts`](./src/community-chest-cards.ts) | Card effects and deck content. |
| [`jail-cards.ts`](./src/jail-cards.ts) | Tracks which deck each held jail-free card came from. |
| [`helpers.ts`](./src/helpers.ts) | Property, build/sell, mortgage, and random-number helpers. |
| [`player-colors.ts`](./src/player-colors.ts), [`player-names.ts`](./src/player-names.ts) | Shared player setup helpers. |
| [`validate-action.ts`](./src/validate-action.ts) | Validation of incoming multiplayer actions. |
| [`socket-types.ts`](./src/socket-types.ts) | Shared lobby types; the filename is historical (multiplayer now uses REST + SSE). |

Unit tests live alongside the source as `src/*.test.ts`.

## Development

Run these commands from the repository root:

```bash
npm test --workspace=packages/game-logic
npm run type-check --workspace=packages/game-logic
npm run build --workspace=packages/game-logic
npm run lint:md
```

The build uses TypeScript to emit CommonJS JavaScript and type declarations into `dist/`. The package's `main` and `types` entries point there.

When adding a game rule, update the action types and reducer in `src/reducer.ts`, add a case to `src/validate-action.ts` if clients may send the new action online, and add Vitest coverage for both valid and rejected use. Keep all platform-specific code outside this package.

For the project's full setup and multiplayer design, see the [root README](../../README.md), [architecture guide](../../docs/ARCHITECTURE.md), and [package contributor notes](./AGENTS.md).
