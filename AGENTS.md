# Guidelines for AI Agents

Welcome to the Trade Tycoon repository. You are an AI agent contributing to a Monopoly-style trading game. This document serves as your primary operating manual.

## 1. Project Context

**Trade Tycoon** is a monorepo containing a cross-platform mobile/web game.

- **Client:** React Native (Expo) in `apps/client`.
- **Server:** Node.js (Express/Socket.io) in `apps/server`.
- **Logic:** Shared TypeScript library in `packages/game-logic`.

**Key Directives:**

- **Monorepo:** Respect workspace boundaries. Do not edit `node_modules` or build artifacts directly.
- **Node Version:** Ensure compatibility with Node.js 24 (see `.nvmrc`).
- **State Management:** The game uses a strict **Reducer Pattern**. All game rules and state mutations **MUST** occur in `packages/game-logic`. The client and server merely consume this logic.

## 2. Documentation & References

Before starting any task, consult these files:

- **`README.md`**: General setup and project overview.
- **`SPECIFICATION.md`**: The source of truth for feature implementation status. Check this to see what is implemented, partial, or pending.
- **`ARCHITECTURE.md`**: Explains the data flow, directory structure, and future multiplayer plans.

## 3. Development Workflow

**You must follow the "Logic First" approach for all game features:**

1. **Modify Logic (`packages/game-logic`)**:
   - Define Types/Interfaces in `src/types.ts` (or relevant files).
   - Implement state transitions in `src/reducer.ts` (or sub-reducers).
   - **MANDATORY:** Write and pass unit tests for the new logic using `vitest`.
   - _Command:_ `npm test --workspace=packages/game-logic`

2. **Update Client (`apps/client`)**:
   - Import the updated logic/types.
   - Implement UI components to render the new state.
   - Dispatch actions to trigger the logic.
   - _Command:_ `npm run lint --workspace=apps/client` (to ensure code quality)

3. **Update Server (`apps/server`)** (if applicable):
   - Ensure the server correctly handles the new actions/state if multiplayer features are involved.

## 4. Essential Commands

Execute these from the root directory:

- **Install Dependencies:**
  `npm install`

- **Test Game Logic:**
  `npm run test --workspace=packages/game-logic`

- **Build Game Logic:**
  `npm run build --workspace=packages/game-logic`
  _(Note: You must build `game-logic` before building/running the server or client if they depend on the built artifact, though typically they use source in dev)._

- **Lint Client:**
  `npm run lint --workspace=apps/client`

- **Run All Tests:**
  `npm test` (This runs tests across workspaces if configured)

## 5. Coding Standards

- **TypeScript:** Use strict typing. Avoid `any`. Define interfaces for all state and actions.
- **Immutability:** The `game-logic` state must be immutable. Always return a new state object in reducers.
- **Testing:** Do not consider a logic task complete without passing tests in `packages/game-logic`.
- **Clean Code:** Keep files small and focused. Refactor if a reducer becomes too large.

## 6. Verification

After every change:

1. **Read** the modified files to verify content.
2. **Run Tests** relevant to your change (especially `game-logic`).
3. **Check Status** against `SPECIFICATION.md` if you completed a feature.

## 7. Troubleshooting

- If the server or client fails to build, check if `packages/game-logic` needs to be rebuilt or if types are exported correctly.
- If a test fails, read the error output carefully. Do not guess; use `console.log` or debugging to isolate the issue in the logic.

---

## End of Guidelines
