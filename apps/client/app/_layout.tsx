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
