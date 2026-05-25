import { describe, it, expect, vi } from 'vitest';
import { BOARD } from './board-data';
import { createInitialState, createPlayer } from './game-setup';

describe('game-setup', () => {
  it('createInitialState returns expected defaults', () => {
    const state = createInitialState();

    expect(state.players).toEqual([]);
    expect(state.currentPlayerId).toBe('');
    expect(state.dice).toEqual([1, 1]);
    expect(state.phase).toBe('roll');
    expect(state.board).toBe(BOARD);
    expect(state.winner).toBeNull();
    expect(state.auction).toBeNull();
    expect(state.activeTrade).toBeNull();
    expect(state.logs).toEqual([]);
  });

  it('createPlayer initializes a player with defaults', () => {
    const player = createPlayer('p1', 'Alice');

    expect(player.id).toBe('p1');
    expect(player.name).toBe('Alice');
    expect(player.money).toBe(1500);
    expect(player.position).toBe(0);
    expect(player.isInJail).toBe(false);
    expect(player.jailTurns).toBe(0);
    expect(player.properties).toEqual([]);
    expect(player.houses).toEqual({});
    expect(player.mortgaged).toEqual([]);
    expect(player.getOutOfJailCards).toBe(0);
    expect(player.color).toMatch(/^#[0-9a-f]{1,6}$/);
  });

  it('createPlayer generates color from Math.random output', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const player = createPlayer('p2', 'Bob');
      expect(player.color).toBe('#7fffff');
    } finally {
      randomSpy.mockRestore();
    }
  });
});
