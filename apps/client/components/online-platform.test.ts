import { describe, expect, it } from 'vitest';
import { getOnlineServerUrl, supportsOnlineEventStream } from './online-platform';

describe('online-platform', () => {
  it('prefers the configured public server URL when one is provided', () => {
    expect(
      getOnlineServerUrl({
        platform: 'ios',
        expoPublicServerUrl: 'https://trade-tycoon-server.example.com',
        isDev: false,
      })
    ).toBe('https://trade-tycoon-server.example.com');
  });

  it('uses localhost for web builds in dev', () => {
    expect(
      getOnlineServerUrl({
        platform: 'web',
        expoPublicServerUrl: '',
        isDev: true,
      })
    ).toBe('http://localhost:3001');
  });

  it('uses the iOS simulator loopback host for native ipad builds in dev', () => {
    expect(
      getOnlineServerUrl({
        platform: 'ios',
        expoPublicServerUrl: '',
        isDev: true,
      })
    ).toBe('http://127.0.0.1:3001');
  });

  it('keeps the android emulator host for android builds in dev', () => {
    expect(
      getOnlineServerUrl({
        platform: 'android',
        expoPublicServerUrl: '',
        isDev: true,
      })
    ).toBe('http://10.0.2.2:3001');
  });

  it('falls back to a same-origin relative URL for an unconfigured production web build', () => {
    expect(
      getOnlineServerUrl({
        platform: 'web',
        expoPublicServerUrl: '',
        isDev: false,
      })
    ).toBe('');
  });

  it('returns null (never localhost) for an unconfigured production native build', () => {
    expect(
      getOnlineServerUrl({
        platform: 'ios',
        expoPublicServerUrl: '',
        isDev: false,
      })
    ).toBeNull();
    expect(
      getOnlineServerUrl({
        platform: 'android',
        expoPublicServerUrl: undefined,
        isDev: false,
      })
    ).toBeNull();
  });

  it('uses SSE only for browser builds that expose EventSource', () => {
    expect(supportsOnlineEventStream({ platform: 'web', eventSourceAvailable: true })).toBe(true);
    expect(supportsOnlineEventStream({ platform: 'web', eventSourceAvailable: false })).toBe(false);
    expect(supportsOnlineEventStream({ platform: 'ios', eventSourceAvailable: false })).toBe(false);
  });
});
