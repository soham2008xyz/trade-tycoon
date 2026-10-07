import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Routes the Android hardware Back button to `onBack` while the calling
 * screen is mounted (#315). The top-level screens are a state machine in
 * `app/index.tsx`, not a router stack, so an unconsumed Back falls through to
 * the router, which has nothing to pop, and the app exits. With a handler the
 * event is consumed; with `undefined` it falls through (the main menu relies
 * on that to exit as normal).
 *
 * Open `Modal`s take Back first through their `onRequestClose`, so this only
 * fires when no modal is up. The latest handler lives in a ref so the
 * listener subscribes once: handlers are often inline arrows upstream, and
 * re-subscribing on every render would reorder listeners. Android only: iOS
 * has no Back button and react-native-web's BackHandler logs a console error
 * when subscribed to.
 */
export function useAndroidBack(onBack: (() => void) | undefined): void {
  const onBackRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    onBackRef.current = onBack ?? null;
  }, [onBack]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const handler = onBackRef.current;
      if (!handler) return false;
      handler();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, []);
}
