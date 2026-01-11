import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { Player } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';

interface Props {
  visible: boolean;
  logs: string[];
  players: Player[];
  onClose: () => void;
}

export const LogModal: React.FC<Props> = ({ visible, logs, players, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Game Log</Text>

          <ScrollView style={styles.logList}>
            {(!logs || logs.length === 0) ? (
              <Text style={styles.emptyText}>No logs yet.</Text>
            ) : (
              logs.map((log, index) => {
                const match = log.match(/^\[(.*?)\]/);
                let color = 'transparent';
                if (match) {
                  const name = match[1];
                  const player = players.find((p) => p.name === name);
                  if (player) color = player.color;
                }

                return (
                  <View key={index} style={styles.logItem}>
                     {color !== 'transparent' && (
                        <View style={[styles.playerColorIndicator, { backgroundColor: color }]} />
                      )}
                    <Text style={styles.logText}>{log}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <IconButton title="Close" icon="close" onPress={onClose} />
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  logText: {
    fontSize: 16,
    flexShrink: 1, // Allow text to wrap if it's too long
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
