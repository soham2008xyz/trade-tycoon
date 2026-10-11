import { describe, it, expect, vi, afterEach } from 'vitest';
import { DEFAULT_TURN_TIMER_CONFIG } from '@trade-tycoon/game-logic';
import { resolveTurnTimerConfig } from './turnTimerConfig';

afterEach(() => vi.restoreAllMocks());

describe('resolveTurnTimerConfig', () => {
  it('uses the defaults when nothing is set', () => {
    expect(resolveTurnTimerConfig({})).toEqual(DEFAULT_TURN_TIMER_CONFIG);
  });

  it('reads the two limits independently, in seconds', () => {
    expect(
      resolveTurnTimerConfig({
        TURN_TIME_LIMIT_SECONDS: '90',
        AUCTION_TURN_TIME_LIMIT_SECONDS: '15',
      })
    ).toEqual({ turnLimitMs: 90_000, auctionLimitMs: 15_000 });
    expect(resolveTurnTimerConfig({ TURN_TIME_LIMIT_SECONDS: '90' })).toEqual({
      turnLimitMs: 90_000,
      auctionLimitMs: DEFAULT_TURN_TIMER_CONFIG.auctionLimitMs,
    });
  });

  it('lets 0 switch a timer off', () => {
    expect(resolveTurnTimerConfig({ AUCTION_TURN_TIME_LIMIT_SECONDS: '0' }).auctionLimitMs).toBe(0);
  });

  it('falls back to the default, with a warning, for an invalid value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = resolveTurnTimerConfig({
      TURN_TIME_LIMIT_SECONDS: 'soon',
      AUCTION_TURN_TIME_LIMIT_SECONDS: '-5',
    });

    expect(config).toEqual(DEFAULT_TURN_TIMER_CONFIG);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
