import { DEFAULT_TURN_TIMER_CONFIG, type TurnTimerConfig } from '@trade-tycoon/game-logic';

/** Longest limit accepted, so a typo can't make a timer effectively infinite. */
const MAX_SECONDS = 24 * 60 * 60;

const parseSeconds = (raw: string | undefined, fallbackMs: number, name: string): number => {
  if (raw === undefined || raw.trim() === '') return fallbackMs;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS) {
    console.warn(`[config] Ignoring invalid ${name}="${raw}"; using ${fallbackMs / 1000}s`);
    return fallbackMs;
  }
  // 0 is meaningful: it switches that timer off.
  return seconds * 1000;
};

/**
 * Reads the turn limits from the environment. The two limits are independent:
 * `TURN_TIME_LIMIT_SECONDS` (a whole player turn) and
 * `AUCTION_TURN_TIME_LIMIT_SECONDS` (one bidder's bid-or-pass). Unset uses the
 * game-logic defaults; `0` disables that timer; anything else invalid falls
 * back to the default with a warning rather than crashing the server at boot.
 */
export function resolveTurnTimerConfig(env: NodeJS.ProcessEnv): TurnTimerConfig {
  return {
    turnLimitMs: parseSeconds(
      env.TURN_TIME_LIMIT_SECONDS,
      DEFAULT_TURN_TIMER_CONFIG.turnLimitMs,
      'TURN_TIME_LIMIT_SECONDS'
    ),
    auctionLimitMs: parseSeconds(
      env.AUCTION_TURN_TIME_LIMIT_SECONDS,
      DEFAULT_TURN_TIMER_CONFIG.auctionLimitMs,
      'AUCTION_TURN_TIME_LIMIT_SECONDS'
    ),
  };
}
