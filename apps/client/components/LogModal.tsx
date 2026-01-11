import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { Player } from '@trade-tycoon/game-logic';
import { IconButton } from './ui/IconButton';
import { CloseButton } from './ui/CloseButton';

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
          <View style={styles.header}>
            <Text style={styles.title}>Game Log</Text>
            <View style={styles.closeBtnContainer}>
              <CloseButton onPress={onClose} />
            </View>
          </View>

          <ScrollView style={styles.logList}>
            {!logs || logs.length === 0 ? (
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
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
    flex: 1,
    elevation: 5,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    minHeight: 40,
  },
  closeBtnContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
});
