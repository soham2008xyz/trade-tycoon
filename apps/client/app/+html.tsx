import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { darkTheme } from '../constants/theme';

// Crawlers don't resolve relative og:url / og:image, and a static export has
// no request to read the host from, so the production host is fixed here.
// Keep in sync with docs/DEPLOY.md.
const SITE_URL = 'https://trade-tycoon.sohambanerjee.me';
const SITE_DESCRIPTION =
  'Buy, trade and build your way to the top in a property-trading board game. Play pass-and-play on one device or online with friends.';

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

export default function Html({ children }: PropsWithChildren) {
  const { htmlAttributes, headNodes, bodyAttributes, bodyNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Trade Tycoon" />
        <meta property="og:title" content="Trade Tycoon" />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Tycoon" />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
        <ScrollViewStyleReset />
        <style id="color-scheme">{COLOR_SCHEME_CSS}</style>
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
