# The game screen picks a phone or tablet layout by window width

The game screen chooses between a phone layout and a tablet layout from the smaller window dimension, with a breakpoint of 600pt, not from the device type. The phone layout puts the board on top with a draggable bottom sheet below; the tablet layout keeps the status and action panel in the board's centre. The breakpoint also covers small Android phones, narrow web windows and iPad split-view, and the layout flips as the window resizes. State that must survive a flip, such as an open trade or the selected tile, lives in `GameUI` rather than in the layout components.

The decision came out of a design brainstorm for the iPhone layout. The app had been laid out for an iPad in portrait, where the board's centre hole is large enough for the whole status panel; on a phone it shrinks to roughly 270pt square and the content no longer fits.

## Considered options

- **A card-based or phase-modal shell that hides the board.** Rejected; the board stays visible at all times. The sheet's peek state holds the current player, the dice and every action button valid for the phase, and dragging it open is reserved for other players, the log and the property manager.

## Consequences

- On phones the five game modals take over the full screen, and edge tiles drop their names in favour of colour strip and price when the board is small. Names remain available through the tile-info modal.
- Portrait only. The app locks orientation at the root layout for native platforms, and phone landscape was left out of scope.
- The bottom sheet is a third-party library that needed a local patch for the current React Native and Reanimated versions; the patch is recorded in `patches/`.
