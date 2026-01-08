import React, { useReducer, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Button,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Board } from '../components/Board';
import { createInitialState, gameReducer, Action, BOARD } from '@trade-tycoon/game-logic';

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;

  // Add 2 local players on mount
  useEffect(() => {
    dispatch({ type: 'JOIN_GAME', playerId: 'p1', name: 'Player 1' });
    dispatch({ type: 'JOIN_GAME', playerId: 'p2', name: 'Player 2' });
  }, []);

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const currentTile = currentPlayer ? BOARD[currentPlayer.position] : null;

  const handleRoll = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'ROLL_DICE', playerId: state.currentPlayerId });
    }
  };

  const handleEndTurn = () => {
    if (state.currentPlayerId) {
      dispatch({ type: 'END_TURN', playerId: state.currentPlayerId });
    }
  };

  const handleBuy = () => {
    if (state.currentPlayerId && currentTile) {
      dispatch({
        type: 'BUY_PROPERTY',
        playerId: state.currentPlayerId,
        propertyId: currentTile.id,
      });
    }
  };

  if (!currentPlayer) return <Text>Loading...</Text>;

  // Check buy availability
  const canBuy =
    state.phase === 'action' &&
    currentTile?.price &&
    !state.players.some((p) => p.properties.includes(currentTile.id)) &&
    currentPlayer.money >= currentTile.price;

  return (
    <SafeAreaView style={[styles.container, { flexDirection: isLandscape ? 'row' : 'column' }]}>
      <View style={styles.boardArea}>
        <Board players={state.players} />
      </View>

      <View style={styles.controls}>
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          {state.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={[styles.playerColor, { backgroundColor: player.color }]} />
              <Text style={styles.playerText}>
                {player.name}: ${player.money}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>Current: {currentPlayer.name}</Text>
          <Text style={styles.statusText}>Money: ${currentPlayer.money}</Text>
          <Text style={styles.statusText}>Pos: {currentTile?.name}</Text>
          <Text style={styles.statusText}>
            Dice: {state.dice[0]} + {state.dice[1]}
          </Text>
        </View>

        <View style={styles.actions}>
          {state.phase === 'roll' && <Button title="Roll Dice" onPress={handleRoll} />}

          {state.phase === 'action' && (
            <>
              {canBuy && <Button title={`Buy ($${currentTile.price})`} onPress={handleBuy} />}
              <Button title="End Turn" onPress={handleEndTurn} color="red" />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  boardArea: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  controls: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  status: {
    marginBottom: 20,
  },
  playerList: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  playerColor: {
    width: 20,
    height: 20,
    marginRight: 10,
    borderRadius: 4,
  },
  playerText: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 18,
    marginBottom: 5,
  },
  actions: {
    gap: 10,
  },
});
