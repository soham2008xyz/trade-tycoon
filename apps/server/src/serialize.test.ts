import { describe, it, expect } from 'vitest';
import { createInitialState, type LobbyState } from '@trade-tycoon/game-logic';
import { toPublicGameState, toPublicLobbyState } from './serialize';

describe('serialize boundary', () => {
  it('strips errorMessage from a public game state', () => {
    const state = { ...createInitialState(), errorMessage: 'Not enough money' };
    const publicState = toPublicGameState(state);
    expect('errorMessage' in publicState).toBe(false);
  });

  it('strips sessions and any nested errorMessage from a public lobby state', () => {
    const lobby: LobbyState = {
      roomId: 'ROOM1234',
      players: [],
      status: 'game',
      sessions: { 'secret-token': 'p1' },
      version: 1,
      gameState: { ...createInitialState(), errorMessage: 'private feedback' },
    };

    const publicLobby = toPublicLobbyState(lobby);

    expect('sessions' in publicLobby).toBe(false);
    expect(publicLobby.gameState).toBeTruthy();
    expect('errorMessage' in publicLobby.gameState!).toBe(false);
  });
});
