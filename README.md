# Trade Tycoon

A Monopoly-style trading game built with React Native (Expo) and a shared game logic package.

## Project Structure

- `apps/client`: The React Native mobile application.
- `packages/game-logic`: Core game rules, state management, and types (TypeScript).

## Getting Started

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Run the client:**

    ```bash
    npm run ios --workspace=apps/client
    # or
    npm run android --workspace=apps/client
    # or
    npm run web --workspace=apps/client
    ```

## Development

For detailed feature tracking and implementation status, please refer to [SPECIFICATION.md](./SPECIFICATION.md).

- **Game Logic:**
  - Tests: `npm run test --workspace=packages/game-logic`
  - Build: `npm run build --workspace=packages/game-logic`
