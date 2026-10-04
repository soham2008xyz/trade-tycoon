# All game rules live in one pure, platform-free package

Every rule and state transition lives in `packages/game-logic` as an immutable reducer with no React, React Native, Node or browser imports. Hotseat play runs it in the client and online play runs the same reducer authoritatively on the server, so the two modes cannot drift apart and the server never trusts a client's view of the rules. The client and server consume the reducer; they never re-implement a rule.

## Consequences

- The package must run unchanged in Node, Expo and the browser, so anything platform-specific is passed in by the caller (an rng, a platform string) rather than imported.
- The reducer never throws on an illegitimate action; it refuses it in one of the ways described in [ADR 0004](0004-rejected-actions-abort-and-return-409.md).
- Other workspaces resolve the package through its built `dist/` output, which is gitignored and not produced by `npm install`. Every script that imports it, including client lint and server tests, therefore builds it first, and a fresh clone fails until it has been built.
- Some data that is not a game rule also lives here, because both sides must agree on its shape: the lobby/room types and the network-boundary action validator ([ADR 0005](0005-private-session-token-and-opt-in-resume.md), [ADR 0007](0007-untrusted-actions-are-validated-at-the-boundary.md)).
