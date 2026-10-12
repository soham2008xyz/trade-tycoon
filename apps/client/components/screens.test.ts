import { describe, it, expect } from 'vitest';
import { pageViewFor, type Screen } from './screens';

describe('pageViewFor', () => {
  const screens: Screen[] = [
    'new-game',
    'local-game',
    'multiplayer-menu',
    'online-create',
    'online-join',
    'online-resume',
  ];

  it('reports the main menu at the root path', () => {
    expect(pageViewFor('new-game')).toEqual({ path: '/', title: 'Main menu' });
  });

  it('gives every screen its own virtual path and title', () => {
    const views = screens.map(pageViewFor);
    expect(new Set(views.map((v) => v.path)).size).toBe(screens.length);
    expect(new Set(views.map((v) => v.title)).size).toBe(screens.length);
  });
});
