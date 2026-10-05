import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a screen that contains text inputs so the on-screen keyboard neither
 * covers the form nor sticks around once the user is done typing.
 *
 * - iOS: `KeyboardAvoidingView` shrinks the screen to the space above the
 *   keyboard, so a centred card re-centres and a card with its own
 *   `maxHeight` shrinks and scrolls. Android resizes the window itself
 *   (Expo's default `adjustResize`), so adding padding there would double up.
 * - Tapping empty space dismisses the keyboard. Native only: on web there is
 *   no on-screen keyboard, and a press handler around the inputs would blur a
 *   field right after it is focused.
 *
 * `style` lays out the card inside the screen (centring, padding).
 */
export const KeyboardAwareScreen: React.FC<Props> = ({ children, style }) => {
  const isWeb = Platform.OS === 'web';

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isWeb ? (
        <View style={[styles.fill, style]}>{children}</View>
      ) : (
        <Pressable style={[styles.fill, style]} onPress={Keyboard.dismiss} accessible={false}>
          {children}
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
