import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { IconButton } from './ui/IconButton';

interface PlayerConfig {
  name: string;
  color: string;
}

interface Props {
  visible: boolean;
  onStartGame: (players: PlayerConfig[]) => void;
}

const COLORS = [
  '#FF0000',
  '#0000FF',
  '#008000',
  '#FFFF00',
  '#FFA500',
  '#800080',
  '#00FFFF',
  '#FFC0CB',
];

export const GameSetup: React.FC<Props> = ({ visible, onStartGame }) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: 'Player 1', color: COLORS[0] },
    { name: 'Player 2', color: COLORS[1] },
  ]);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    const newPlayers = [...players];
    if (count > players.length) {
      for (let i = players.length; i < count; i++) {
        newPlayers.push({ name: `Player ${i + 1}`, color: COLORS[i % COLORS.length] });
      }
    } else {
      newPlayers.splice(count);
    }
    setPlayers(newPlayers);
  };

  const updatePlayer = (index: number, field: keyof PlayerConfig, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    setPlayers(newPlayers);
  };

  const handleSubmit = () => {
    onStartGame(players);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Game Setup</Text>

          <View style={styles.countContainer}>
            <Text>Number of Players:</Text>
            <View style={styles.countButtons}>
              {[2, 3, 4, 5, 6].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.countButton, playerCount === num && styles.activeCountButton]}
                  onPress={() => handlePlayerCountChange(num)}
                >
                  <Text
                    style={[
                      styles.countButtonText,
                      playerCount === num && styles.activeCountButtonText,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView style={styles.playersList}>
            {players.map((player, index) => (
              <View key={index} style={styles.playerRow}>
                <Text style={styles.playerLabel}>Player {index + 1}</Text>
                <TextInput
                  style={styles.input}
                  value={player.name}
                  onChangeText={(text) => updatePlayer(index, 'name', text)}
                  placeholder="Name"
                />
                <View style={styles.colorPicker}>
                  {COLORS.slice(0, 8).map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        player.color === color && styles.selectedColor,
                      ]}
                      onPress={() => updatePlayer(index, 'color', color)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <IconButton title="Start Game" icon="play" onPress={handleSubmit} />
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
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
    elevation: 5,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.25)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  countContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  countButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  countButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  activeCountButton: {
    backgroundColor: '#007AFF',
  },
  countButtonText: {
    fontSize: 16,
  },
  activeCountButtonText: {
    color: 'white',
  },
  playersList: {
    marginBottom: 20,
  },
  playerRow: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  playerLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: 'black',
  },
});
