# All game rules live in one pure, platform-free package

Every rule and state transition lives in `packages/game-logic` as a reducer with no React, React Native, Node or browser imports. Hotseat play runs it in the client and online play runs the same reducer authoritatively on the server, so the two modes cannot drift apart and the server never trusts a client's view of the rules. The cost is that the package must run unchanged in Node, Expo and the browser, so anything platform-specific has to be passed in by the caller.
