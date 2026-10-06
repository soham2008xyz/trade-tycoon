import { describe, expect, it } from 'vitest';
import { buildRoomShareMessage } from './online-room-share';

describe('buildRoomShareMessage', () => {
  it('includes the room code', () => {
    expect(buildRoomShareMessage('ABCD1234')).toContain('ABCD1234');
  });

  it('names the game so the recipient knows what the code is for', () => {
    expect(buildRoomShareMessage('ABCD1234')).toMatch(/Trade Tycoon/);
  });
});
