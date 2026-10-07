/** A `FullScreenModalShell` modal that can draw the game toasts over itself. */
export type ToastHost = 'auction' | 'trade' | 'manage' | 'log' | 'tile';

/** Which modals are on screen. Each flag must mean "mounted and visible". */
export type OpenModals = Record<ToastHost, boolean>;

/**
 * The modal that should draw the game toasts, or `null` to draw them at the
 * `GameUI` root. A `Modal` covers the whole app, so a toast drawn beneath an
 * open one can't be seen (#323).
 *
 * The order is "topmost first". Manage, Log and Tile info are opened from the
 * main screen, which any open modal covers, so at most one of them is open.
 * Trade and Auction are driven by state another player can change (an
 * incoming proposal, a declined purchase), so they can open over the others —
 * and an auction can start while the trade modal is open.
 */
export const getToastHost = (open: OpenModals): ToastHost | null => {
  const topmostFirst: readonly [ToastHost, boolean][] = [
    ['auction', open.auction],
    ['trade', open.trade],
    ['manage', open.manage],
    ['log', open.log],
    ['tile', open.tile],
  ];
  return topmostFirst.find(([, isOpen]) => isOpen)?.[0] ?? null;
};
