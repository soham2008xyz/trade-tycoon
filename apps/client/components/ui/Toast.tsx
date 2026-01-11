import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 3000 }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [fadeAnim, onDismiss]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, handleDismiss, fadeAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity onPress={handleDismiss} activeOpacity={0.8}>
        <View style={styles.content}>
          <Text style={styles.text}>{message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Safe area top
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
