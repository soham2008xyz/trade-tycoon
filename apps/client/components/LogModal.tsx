import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Button, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  logs: string[];
  onClose: () => void;
}

export const LogModal: React.FC<Props> = ({ visible, logs, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Game Log</Text>

          <ScrollView style={styles.logList}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No logs yet.</Text>
            ) : (
              logs.map((log, index) => (
                <View key={index} style={styles.logItem}>
                  <Text style={styles.logText}>{log}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Close" onPress={onClose} />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    width: '90%',
    maxWidth: 600,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  logList: {
    marginBottom: 20,
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logText: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  footer: {
    alignItems: 'center',
  },
});
