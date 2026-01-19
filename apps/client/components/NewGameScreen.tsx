import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { IconButton } from './ui/IconButton';

interface Props {
  onLocalMultiplayer: () => void;
  onOnlineMultiplayer: () => void;
}

export const NewGameScreen: React.FC<Props> = ({ onLocalMultiplayer, onOnlineMultiplayer }) => {
  return (
    <Modal visible={true} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Trade Tycoon</Text>

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    elevation: 5,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  button: {
    width: '100%',
  },
});
