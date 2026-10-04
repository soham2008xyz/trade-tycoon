# Client rules live in pure modules, tested in Node, with no component test harness

The client's tests run under vitest in a plain Node environment, with no jsdom and no React Testing Library. Anything that needs testing is therefore lifted out of the component into a pure `.ts` module, which imports nothing from React, React Native or Expo, and the component stays a thin wiring layer. Examples are the visibility predicates in `multiplayer-gating.ts`, the room sync engine in `online-sync.ts`, the REST calls in `online-api.ts`, the platform and session helpers, and the status-panel action rules. Components are `.tsx`; testable logic is `.ts`, and tests import from the `.ts` module, never from a component.

## Considered options

- **Rendering components in tests with React Testing Library.** The iPhone layout design proposed component tests for the new status panel, but no such harness exists in the client and the repo's convention is to lift the logic into a pure module instead. The audit's remedy for the untested multiplayer client was likewise extraction, not rendering the React Native tree.

## Consequences

- Platform-specific values are injected rather than imported. `online-session.ts` takes the platform as a parameter, and `online-sync.ts` takes injectable `EventSource` and snapshot-fetch functions so a fake can replace them. A framework-free engine was chosen over a React hook for sync because the repo's tests could not exercise a hook.
- A rule about whether a control is visible lives in one predicate beside its unit test and is called by the component, which does not re-implement it. This matters because hotseat and online play share the same components and differ only in identity.
- Where a module has to touch React Native, as hooks do, the decision itself is exported as a pure function, such as `pickLayout` in `useGameLayout.ts`, so it can still be tested without mocking the hook.
- Component rendering, native behaviour and layout are not covered by automated tests. The CI runner cannot exercise native code, so those are verified by running the app.
