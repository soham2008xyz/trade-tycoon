import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { IconButton } from './ui/IconButton';

interface Props {
  onBack: () => void;
  onJoinRoom: () => void;
  onCreateRoom: () => void;
}

export const MultiplayerMenuScreen: React.FC<Props> = ({
  onBack,
  onJoinRoom,
  onCreateRoom
}) => {
  return (
    <Modal visible={true} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Online Multiplayer</Text>

          <View style={styles.buttonContainer}>
            <IconButton
              title="Create New Room"
              icon="plus-circle"
              onPress={onCreateRoom}
              style={styles.button}
            />
            <IconButton
              title="Join Existing Room"
              icon="login"
              onPress={onJoinRoom}
              style={styles.button}
            />
            <IconButton
              title="Back"
              icon="arrow-left"
              onPress={onBack}
              style={styles.secondaryButton}
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
    fontSize: 28,
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
  secondaryButton: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#666',
  }
});
