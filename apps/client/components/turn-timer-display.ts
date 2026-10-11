import type { TurnTimer } from '@trade-tycoon/game-logic';

// Generic so call sites name no `TurnTimer | null` union: Codacy can't resolve
// the game-logic types, reads them as `any` and flags such unions as redundant.
export type Maybe<T> = T | null | undefined;

/** Under this much time left the countdown is drawn as urgent. */
export const LOW_TIME_MS = 10_000;

/**
 * Time left on the running timer in ms, measured on the **local** clock, or
 * null when there is nothing to draw (hotseat, timers disabled, or a snapshot
 * that was never localized — see `localizeTurnTimer` in game-logic). Never
 * negative: an overdue clock reads 0 until the server's timeout arrives.
 */
export const getRemainingMs = (timer: Maybe<TurnTimer>, now: number): number | null => {
  if (!timer || timer.expiresAt === undefined) return null;
  return Math.max(0, timer.expiresAt - now);
};

/** `m:ss`, rounding partial seconds up so the display hits 0:00 only at expiry. */
export const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const isTimeLow = (ms: number): boolean => ms <= LOW_TIME_MS;

/**
 * Who the clock belongs to and what it is for, e.g. `You · 1:05` or
 * `Bob's bid · 0:12`. Online players each see their own device, so "You" vs the
 * name is what tells them at a glance whether the clock is theirs.
 */
export const getTimerLabel = (
  timer: TurnTimer,
  playerName: string,
  isMe: boolean,
  remainingMs: number
): string => {
  const isBid = timer.kind === 'auction';
  let subject = isMe ? 'You' : playerName;
  if (isBid) subject = isMe ? 'You (bid)' : `${playerName}'s bid`;
  return `${subject} · ${formatCountdown(remainingMs)}`;
};

/** Screen-reader text: whole seconds, no `·`, so it reads naturally. */
export const getTimerAccessibilityLabel = (
  timer: TurnTimer,
  playerName: string,
  isMe: boolean,
  remainingMs: number
): string => {
  const seconds = Math.ceil(remainingMs / 1000);
  const who = isMe ? 'Your' : `${playerName}'s`;
  const what = timer.kind === 'auction' ? 'bidding time' : 'turn time';
  return `${who} ${what}: ${seconds} ${seconds === 1 ? 'second' : 'seconds'} left`;
};
