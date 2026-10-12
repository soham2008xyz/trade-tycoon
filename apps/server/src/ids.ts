import { PLAYER_COLORS } from '@trade-tycoon/game-logic';
import { randomBytes, randomInt } from 'crypto';

const ROOM_ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomId(): string {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += ROOM_ID_CHARS.charAt(randomInt(ROOM_ID_CHARS.length));
  }
  return result;
}

export function generateUserId(): string {
  return randomBytes(9).toString('base64url');
}

export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export function pickRandomColor(excludeColors: string[] = []): string {
  const available = PLAYER_COLORS.filter((c) => !excludeColors.includes(c));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  // Fallback to random
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}
