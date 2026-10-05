import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { darkTheme } from '../constants/theme';

// Same background the navigation card paints in light mode (react-navigation's
// DefaultTheme). Only the dark value is ours; see `app/_layout.tsx`.
const LIGHT_BACKGROUND = '#f2f2f2';

// Paints the page behind the React tree, so overscroll and the first frame
// before the bundle runs are not white in dark mode. `color-scheme` makes the
// browser draw form controls and scrollbars to match.
const COLOR_SCHEME_CSS = `
:root { color-scheme: light dark; }
body { background-color: ${LIGHT_BACKGROUND}; }
@media (prefers-color-scheme: dark) {
  body { background-color: ${darkTheme.background}; }
}`;

/**
 * Replaces expo-router's generated HTML shell for the static web export. The
 * markup and `ScrollViewStyleReset` are the defaults; only the colour-scheme
 * meta and style are added. Tags from `expo-router/head` (SEO / OG tags in
 * `_layout.tsx`) are still injected into this `<head>`.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <ScrollViewStyleReset />
        <style id="color-scheme" dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
