import { describe, expect, it } from 'vitest';
import { getOnlineServerUrl, supportsOnlineEventStream } from './online-platform';

describe('online-platform', () => {
  it('prefers the configured public server URL when one is provided', () => {
    expect(
      getOnlineServerUrl({
        platform: 'ios',
        expoPublicServerUrl: 'https://trade-tycoon-server.example.com',
      })
    ).toBe('https://trade-tycoon-server.example.com');
  });

  it('uses localhost for web builds', () => {
    expect(
      getOnlineServerUrl({
        platform: 'web',
        expoPublicServerUrl: '',
      })
    ).toBe('http://localhost:3001');
  });

  it('uses the iOS simulator loopback host for native ipad builds', () => {
    expect(
      getOnlineServerUrl({
        platform: 'ios',
        expoPublicServerUrl: '',
      })
    ).toBe('http://127.0.0.1:3001');
  });

  it('keeps the android emulator host for android builds', () => {
    expect(
      getOnlineServerUrl({
        platform: 'android',
        expoPublicServerUrl: '',
      })
    ).toBe('http://10.0.2.2:3001');
  });

  it('uses SSE only for browser builds that expose EventSource', () => {
    expect(supportsOnlineEventStream({ platform: 'web', eventSourceAvailable: true })).toBe(true);
    expect(supportsOnlineEventStream({ platform: 'web', eventSourceAvailable: false })).toBe(
      false
    );
    expect(supportsOnlineEventStream({ platform: 'ios', eventSourceAvailable: false })).toBe(
      false
    );
  });
});
