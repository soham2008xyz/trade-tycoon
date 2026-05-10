import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
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
    <>
      <Head>
        <title>Trade Tycoon</title>
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover,user-scalable=no"
        />
        <meta name="theme-color" content="#1c2434" />
        <meta name="application-name" content="Trade Tycoon" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trade Tycoon" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
