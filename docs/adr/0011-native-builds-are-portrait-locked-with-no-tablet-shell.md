# Native builds are portrait-locked on every device, with no separate tablet shell

On iOS and Android the app locks itself to portrait-up at runtime from the root layout, iPads included, and every screen renders full-screen with no wrapper around it. There is no landscape layout and no tablet-specific shell. Web is not locked; it adapts to whatever window it is given through the width-based layout in [ADR 0008](0008-width-based-phone-and-tablet-layouts.md).

## Considered options

Two iPad-specific approaches were built first and then removed over five days in May 2026. The commit history does not record why either was dropped, only what changed.

- **An installable iPad web app.** The first attempt served iPad users from the exported web app as an installable PWA, with a tablet-class shell that put a sidebar beside the board in landscape.
- **A native iPad shell.** The next day iPad support became a native Expo build, with iPads locked to landscape and phones to portrait, and the same sidebar shell wrapping every screen. The shell and its landscape lock were deleted a few days later, when all platforms moved to portrait-up.

## Consequences

- The board can be sized from the window dimensions directly, without allowing for a sidebar.
- The lock is applied at runtime, not declared: `app.json` still says `orientation: "default"`. `expo-screen-orientation` has to be listed in the `plugins` array for its native module to initialise, otherwise the lock fails silently.
- iPhone landscape is out of scope, and the phone layout was designed on that assumption.
- An iPad therefore runs the tablet layout in portrait, with the status panel in the board's centre. iOS builds also set `supportsTablet` and `requireFullScreen`.
- On iPadOS, a React Native `Modal` that does not set `supportedOrientations` could crash, so the shared modal shell sets it explicitly.
- Native crashes cannot be caught by the Linux CI runner, so native behaviour is checked on a simulator or device.
