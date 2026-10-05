import { useColorScheme } from 'react-native';

import { pickTheme, type Theme } from '../constants/theme';

/**
 * Returns the colour tokens for the current system appearance. Re-renders on
 * change. Works inside a `Modal` too: `useColorScheme` reads the system value
 * directly, so it doesn't need a provider ancestor.
 */
export function useTheme(): Theme {
  return pickTheme(useColorScheme());
}
