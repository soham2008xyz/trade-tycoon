import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from './ui/IconButton';

interface Props {
  onLocalMultiplayer: () => void;
  onOnlineMultiplayer: () => void;
}

export const NewGameScreen: React.FC<Props> = ({ onLocalMultiplayer, onOnlineMultiplayer }) => {
  return (
    <View style={styles.modalContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>Trade Tycoon</Text>
        <Text style={styles.subtitle}>
          Launch a local hotseat board or bring friends into the room with the native iPad layout
          and roomier board stage.
        </Text>

        <View style={styles.buttonContainer}>
          <IconButton
            title="Local Multiplayer"
            icon="account-group"
            onPress={onLocalMultiplayer}
            style={styles.button}
          />
          <IconButton
            title="Online Multiplayer"
            icon="earth"
            onPress={onOnlineMultiplayer}
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 24,
  },
  content: {
    width: '90%',
    maxWidth: 460,
    backgroundColor: '#f8fbff',
    borderRadius: 28,
    padding: 32,
    elevation: 5,
    boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
    color: '#516078',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  button: {
    width: '100%',
  },
});
