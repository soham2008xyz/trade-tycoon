/**
 * Colour tokens for the UI chrome (menus, panels, modals, buttons).
 *
 * Game-semantic colours are deliberately NOT here and do not change with the
 * scheme: `GROUP_COLORS`, the board felt and tile faces, houses/hotels, player
 * colours. The board is a physical object; it stays light in dark mode.
 *
 * Pure module (no react / react-native imports) so vitest can import it in
 * plain Node. The React hook lives in `hooks/useTheme.ts`.
 */
export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;

  // Surfaces
  background: string;
  surface: string;
  /** Menu / setup card on the transparent backdrop. */
  card: string;
  surfaceMuted: string;
  /** Selected row / bidder highlight. */
  surfaceSelected: string;
  surfaceInfo: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Error text. */
  errorText: string;
  successText: string;

  // Lines
  border: string;
  borderStrong: string;
  /** High-contrast outline (tile info card). */
  outline: string;

  // Overlays
  scrim: string;
  /** Translucent panel laid over the board felt on tablet layouts. */
  panelScrim: string;
  toastBg: string;
  toastText: string;

  // Buttons and accents (fills carry `onAccent` labels in both schemes)
  primary: string;
  /** Selected-state accent: border and text on `surfaceSelected`. */
  highlight: string;
  danger: string;
  success: string;
  info: string;
  warning: string;
  brand: string;
  neutralButton: string;
  disabledFill: string;
  disabledText: string;
  onAccent: string;

  // Status chips
  jailText: string;
  jailBg: string;
  jailBorder: string;
  goojText: string;
}

export const lightTheme: Theme = {
  scheme: 'light',

  background: '#ffffff',
  surface: '#ffffff',
  card: '#f8fbff',
  surfaceMuted: '#f9f9f9',
  surfaceSelected: '#f0f8ff',
  surfaceInfo: '#e6fffa',

  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#888888',
  errorText: '#b00020',
  successText: '#008000',

  border: '#eeeeee',
  borderStrong: '#cccccc',
  outline: '#000000',

  scrim: 'rgba(0,0,0,0.5)',
  panelScrim: 'rgba(255,255,255,0.9)',
  toastBg: 'rgba(50,50,50,0.9)',
  toastText: '#ffffff',

  primary: '#2196F3',
  highlight: '#0062cc',
  danger: '#d9534f',
  success: '#4CAF50',
  info: '#5bc0de',
  warning: '#f0ad4e',
  brand: '#841584',
  neutralButton: '#666666',
  disabledFill: '#cccccc',
  disabledText: '#666666',
  onAccent: '#ffffff',

  jailText: '#7c2d12',
  jailBg: '#fff7ed',
  jailBorder: '#9a3412',
  goojText: '#2a7f9c',
};

export const darkTheme: Theme = {
  scheme: 'dark',

  background: '#121212',
  surface: '#1e1e1e',
  card: '#242424',
  surfaceMuted: '#2a2a2a',
  surfaceSelected: '#0d2b47',
  surfaceInfo: '#103a35',

  textPrimary: '#ececec',
  textSecondary: '#b3b3b3',
  textMuted: '#8c8c8c',
  errorText: '#ff6b6b',
  successText: '#6fcf7f',

  border: '#333333',
  borderStrong: '#555555',
  outline: '#d4d4d4',

  scrim: 'rgba(0,0,0,0.7)',
  panelScrim: 'rgba(24,24,24,0.92)',
  toastBg: 'rgba(80,80,80,0.95)',
  toastText: '#ffffff',

  primary: '#2196F3',
  highlight: '#5aaeff',
  danger: '#d9534f',
  success: '#4CAF50',
  info: '#5bc0de',
  warning: '#f0ad4e',
  brand: '#a23ba2',
  neutralButton: '#5c5c5c',
  disabledFill: '#3a3a3a',
  disabledText: '#8c8c8c',
  onAccent: '#ffffff',

  jailText: '#fdba74',
  jailBg: '#3b1d0d',
  jailBorder: '#c2410c',
  goojText: '#7dd3fc',
};

/**
 * Pure scheme → theme selector, exported separately so it's testable without
 * mocking react-native hooks. Anything but "dark" (`null`, `undefined`, or
 * react-native's "unspecified") falls back to light, the pre-dark-mode look.
 */
export function pickTheme(scheme: string | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
