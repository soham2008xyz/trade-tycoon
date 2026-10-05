import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';

// Crawlers don't resolve relative og:url / og:image, and a static export has
// no request to read the host from, so the production host is fixed here.
// Keep in sync with docs/DEPLOY.md.
const SITE_URL = 'https://trade-tycoon.sohambanerjee.me';
const SITE_DESCRIPTION =
  'Buy, trade and build your way to the top in a property-trading board game. Play pass-and-play on one device or online with friends.';

// Light keeps react-navigation's DefaultTheme, so the backdrop behind the menu
// screens is unchanged. Dark swaps in our tokens so the card the Stack paints
// matches the rest of the UI.
function navigationTheme(theme: Theme) {
  if (theme.scheme === 'light') return DefaultTheme;
  return {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: theme.background,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.border,
    },
  };
}

export default function RootLayout() {
  const theme = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((error) => {
        console.warn('Screen orientation lock failed', error);
      });
    }

    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered: ', registration);
          },
          (registrationError) => {
            console.log('SW registration failed: ', registrationError);
          }
        );
      });
    }
  }, []);

  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {Platform.OS === 'web' ? (
          <Head>
            <title>Trade Tycoon</title>
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
          </Head>
        ) : null}
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
