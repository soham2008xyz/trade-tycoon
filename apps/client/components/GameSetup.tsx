import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { IconButton } from './ui/IconButton';
import { KeyboardAwareScreen } from './ui/KeyboardAwareScreen';
import {
  PLAYER_COLORS,
  isColorTakenByOthers,
  limitPlayerNameInput,
  pickUnusedColor,
} from '@trade-tycoon/game-logic';
import { validateSetupPlayers } from './game-setup-validation';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../constants/theme';

interface PlayerConfig {
  name: string;
  color: string;
}

interface Props {
  onStartGame: (players: PlayerConfig[]) => void;
  onBack: () => void;
}

export const GameSetup: React.FC<Props> = ({ onStartGame, onBack }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: 'Player 1', color: PLAYER_COLORS[0] },
    { name: 'Player 2', color: PLAYER_COLORS[1] },
  ]);
  const [error, setError] = useState<string | null>(null);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    const newPlayers = [...players];
    if (count > players.length) {
      for (let i = players.length; i < count; i++) {
        // First unused color, not `COLORS[i]`: players may have picked colors
        // out of order, so the i-th palette slot can already be taken.
        newPlayers.push({ name: `Player ${i + 1}`, color: pickUnusedColor(newPlayers) });
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
    const result = validateSetupPlayers(players);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onStartGame(result.players);
  };

  return (
    <KeyboardAwareScreen style={styles.modalContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>Game Setup</Text>

        <View style={styles.countContainer}>
          <Text style={styles.label}>Number of Players:</Text>
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

        {/* "handled" lets taps on colour swatches work while the keyboard is up
            instead of being swallowed by a dismiss; dragging dismisses it. */}
        <ScrollView
          style={styles.playersList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {players.map((player, index) => (
            <View key={index} style={styles.playerRow}>
              <Text style={styles.playerLabel}>Player {index + 1}</Text>
              <TextInput
                style={styles.input}
                nativeID={`player-name-${index + 1}`}
                accessibilityLabel={`Player ${index + 1} name`}
                value={player.name}
                onChangeText={(text) => {
                  updatePlayer(index, 'name', limitPlayerNameInput(text));
                  setError(null);
                }}
                placeholder="Name"
                placeholderTextColor={theme.textMuted}
                keyboardAppearance={theme.scheme}
              />
              <View style={styles.colorPicker}>
                {PLAYER_COLORS.map((color) => {
                  const taken = isColorTakenByOthers(players, index, color);
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        player.color === color && styles.selectedColor,
                        taken && styles.takenColor,
                      ]}
                      disabled={taken}
                      accessibilityRole="button"
                      accessibilityLabel={`Player ${index + 1} color ${color}${taken ? ' (taken)' : ''}`}
                      accessibilityState={{ disabled: taken, selected: player.color === color }}
                      onPress={() => updatePlayer(index, 'color', color)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {error && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <View style={styles.actionButtons}>
          <IconButton
            title="Back"
            icon="arrow-left"
            onPress={onBack}
            style={{ backgroundColor: theme.neutralButton, flex: 1 }}
          />
          <IconButton title="Start Game" icon="play" onPress={handleSubmit} style={{ flex: 2 }} />
        </View>
      </View>
    </KeyboardAwareScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: 24,
    },
    content: {
      width: '90%',
      maxWidth: 560,
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 24,
      maxHeight: '90%',
      elevation: 5,
      boxShadow: '0px 18px 36px rgba(0,0,0,0.2)',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: theme.textPrimary,
    },
    label: { color: theme.textPrimary },
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
      backgroundColor: theme.border,
    },
    activeCountButton: {
      backgroundColor: theme.highlight,
    },
    countButtonText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    activeCountButtonText: {
      color: theme.onAccent,
    },
    playersList: {
      marginBottom: 20,
    },
    playerRow: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 8,
    },
    playerLabel: {
      fontWeight: 'bold',
      marginBottom: 5,
      color: theme.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      padding: 8,
      borderRadius: 4,
      marginBottom: 10,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
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
      borderColor: theme.outline,
    },
    takenColor: {
      opacity: 0.2,
    },
    errorText: {
      color: theme.errorText,
      textAlign: 'center',
      marginBottom: 8,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
  });
