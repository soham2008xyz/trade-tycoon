# Trade Tycoon

A Monopoly-style trading game with offline single-player and online
multiplayer. The web/mobile client is built with Expo (React Native) and the
multiplayer server is a Node.js Express app that talks REST + Server-Sent
Events on top of Upstash Redis.

## Project Structure

- `apps/client` — Expo client (web, iOS, Android).
- `apps/server` — Express server for multiplayer (REST + SSE).
- `packages/game-logic` — Pure-TypeScript game rules shared by both.

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the multiplayer data flow and
[DEPLOY.md](./docs/DEPLOY.md) for production deployment / env vars.

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the dev loop:**

   ```bash
   npm start             # api-server + expo web (default)
   npm run start:native  # api-server + expo metro (for iOS/Android)
   npm run start:server  # api-server only
   ```

   Or run pieces individually:

   ```bash
   npm run server                    # express server on :3001
   npm run web                       # expo web on :8081
   npm run ios --workspace=apps/client
   npm run android --workspace=apps/client
   ```

   For purely offline play, only the client is needed.

## Development

For detailed feature tracking and implementation status, see
[SPECIFICATION.md](./docs/SPECIFICATION.md).

**Tests:**

```bash
npm test                                          # everything
npm test --workspace=apps/server                  # server only
npm test --workspace=packages/game-logic          # game logic only
```

**Build:**

```bash
npm run build                                     # all workspaces
```

**Lint + format:**

```bash
npm run lint
npm run format
```
