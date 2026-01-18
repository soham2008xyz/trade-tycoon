# Contributing to Trade Tycoon

Thank you for your interest in contributing to Trade Tycoon! We welcome contributions from everyone. This document outlines the guidelines and workflows for contributing to this project.

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Logic First Approach](#logic-first-approach)
  - [Running the Project](#running-the-project)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Project Overview

Trade Tycoon is a Monopoly-style trading game built as a monorepo containing:
- A React Native (Expo) client.
- A Node.js game server.
- A shared TypeScript game logic package.

## Getting Started

### Prerequisites

- **Node.js**: We recommend using the version specified in `.nvmrc` (currently Node 24).
- **npm**: The project uses `npm` for dependency management.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/trade-tycoon.git
    cd trade-tycoon
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```
    This will install dependencies for the root and all workspaces (`apps/client`, `apps/server`, `packages/game-logic`).

## Project Structure

This project is a **monorepo** managed with npm workspaces:

- `apps/client`: The React Native mobile/web application.
- `apps/server`: The backend server handling multiplayer sessions.
- `packages/game-logic`: The core game rules, state management, and types. This package is shared between the client and server.

## Development Workflow

### Logic First Approach

We follow a **"Logic First"** development methodology. All game rules and state mutations must be implemented in the shared logic package before updating the UI or server.

1.  **Modify Logic (`packages/game-logic`)**:
    -   Update types in `src/types.ts`.
    -   Implement game rules in `src/reducer.ts` or relevant files.
    -   **Important:** Write unit tests for your changes.

2.  **Update Client (`apps/client`)**:
    -   Import the updated logic.
    -   Implement UI components to reflect the new state.
    -   Dispatch actions to trigger the logic.

3.  **Update Server (`apps/server`)**:
    -   If the change involves multiplayer features, update the server to handle the new actions or state synchronization.

### Running the Project

**Client:**
To run the client (web is the default for quick development):
```bash
npm run web
# or to start with build
npm start
```
To run on iOS or Android, use:
```bash
npm run ios --workspace=apps/client
npm run android --workspace=apps/client
```

**Server:**
To run the server in development mode:
```bash
npm run server
```

**Game Logic:**
To build the game logic package manually (usually done automatically by other scripts):
```bash
npm run build:game-logic
```

## Testing

We use **Vitest** for testing the game logic.

-   To run all tests across the monorepo:
    ```bash
    npm test
    ```
-   To run tests specifically for game logic:
    ```bash
    npm run test --workspace=packages/game-logic
    ```

Please ensure all tests pass before submitting your changes.

## Linting and Formatting

-   **Linting**: We use ESLint.
    ```bash
    npm run lint
    ```
-   **Formatting**: We use Prettier. Code is automatically formatted on commit via `lint-staged`.

## Pull Request Process

1.  Fork the repository and create your branch from `main`.
2.  Follow the [Logic First](#logic-first-approach) workflow.
3.  Ensure your code builds and tests pass.
4.  Update documentation (like `SPECIFICATION.md` or `README.md`) if necessary.
5.  Open a Pull Request with a clear title and description of your changes.

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub. include as much detail as possible to help us understand and resolve the problem.
