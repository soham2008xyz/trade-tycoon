import { useWindowDimensions } from 'react-native';

export type GameLayout = 'phone' | 'tablet';

export const LAYOUT_BREAKPOINT = 600;

/**
 * Pure layout selector — exported separately so it's testable without
 * mocking react-native hooks.
 */
export function pickLayout(width: number, height: number): GameLayout {
  return Math.min(width, height) < LAYOUT_BREAKPOINT ? 'phone' : 'tablet';
}

/**
 * Returns the active layout mode for the current viewport. Recomputes on
 * window resize (web, iPad split-view, etc.). Coarse `'phone' | 'tablet'`
 * intentionally — callers should not branch on raw pixel widths.
 */
export function useGameLayout(): GameLayout {
  const { width, height } = useWindowDimensions();
  return pickLayout(width, height);
}
