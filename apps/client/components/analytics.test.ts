import { describe, expect, it } from 'vitest';
import { analytics, createAnalytics, parseMeasurementId, type AnalyticsWindow } from './analytics';

function fakeWindow() {
  const scripts: { async: boolean; src: string }[] = [];
  const win: AnalyticsWindow = {
    location: { origin: 'https://example.test' },
    document: {
      createElement: () => ({ async: false, src: '' }),
      head: {
        appendChild: (node) => {
          scripts.push(node as { async: boolean; src: string });
          return node;
        },
      },
    },
  };
  // dataLayer holds Arguments objects; spread them for readable assertions.
  const calls = () => (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
  return { win, scripts, calls };
}

describe('parseMeasurementId', () => {
  it('accepts a GA4 web stream id, trimmed and upper-cased', () => {
    expect(parseMeasurementId(' g-abc123 ')).toBe('G-ABC123');
  });

  it('rejects unset, empty and malformed values', () => {
    expect(parseMeasurementId(undefined)).toBeNull();
    expect(parseMeasurementId('')).toBeNull();
    expect(parseMeasurementId('UA-12345-1')).toBeNull();
    expect(parseMeasurementId('G-ABC"><script>')).toBeNull();
  });
});

describe('createAnalytics', () => {
  it('does nothing without a measurement id', () => {
    const { win, scripts } = fakeWindow();
    const a = createAnalytics(null, () => win);
    a.init();
    a.trackPageView('/', 'Main menu');
    a.trackEvent('create_room');
    expect(scripts).toHaveLength(0);
    expect(win.dataLayer).toBeUndefined();
    expect(win.gtag).toBeUndefined();
  });

  it('does nothing without a browser window (native, server render)', () => {
    const a = createAnalytics('G-TEST', () => undefined);
    expect(() => {
      a.init();
      a.trackPageView('/', 'Main menu');
      a.trackEvent('create_room');
    }).not.toThrow();
  });

  it('loads gtag.js once and configures it without the automatic page view', () => {
    const { win, scripts, calls } = fakeWindow();
    const a = createAnalytics('G-TEST', () => win);
    a.init();
    a.init();
    expect(scripts).toEqual([
      { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST' },
    ]);
    const config = calls().filter(([command]) => command === 'config');
    expect(config).toHaveLength(1);
    expect(config[0]).toEqual([
      'config',
      'G-TEST',
      expect.objectContaining({ send_page_view: false }),
    ]);
  });

  it('queues page views and events after init', () => {
    const { win, calls } = fakeWindow();
    const a = createAnalytics('G-TEST', () => win);
    a.init();
    a.trackPageView('/local-game', 'Local game');
    a.trackEvent('start_local_game', { player_count: 3 });
    const page = { page_location: 'https://example.test/local-game', page_title: 'Local game' };
    expect(calls().slice(-3)).toEqual([
      ['set', page],
      ['event', 'page_view', page],
      ['event', 'start_local_game', { player_count: 3 }],
    ]);
  });

  it('loads gtag on the first track call when init was not called', () => {
    const { win, scripts, calls } = fakeWindow();
    const a = createAnalytics('G-TEST', () => win);
    a.trackPageView('/', 'Main menu');
    expect(scripts).toHaveLength(1);
    expect(calls().map(([command]) => command)).toEqual(['js', 'config', 'set', 'event']);
  });
});

describe('analytics (default instance)', () => {
  it('is inert in the test environment, where the id is unset and there is no document', () => {
    expect(() => {
      analytics.init();
      analytics.trackEvent('create_room');
    }).not.toThrow();
  });
});
