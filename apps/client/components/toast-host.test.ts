import { describe, it, expect } from 'vitest';
import { getToastHost, type OpenModals } from './toast-host';

const none: OpenModals = { auction: false, trade: false, manage: false, log: false, tile: false };

describe('getToastHost', () => {
  it('draws the toasts at the root when no modal is open', () => {
    expect(getToastHost(none)).toBeNull();
  });

  it.each(['auction', 'trade', 'manage', 'log', 'tile'] as const)(
    'hosts them in %s when it is the only open modal',
    (host) => {
      expect(getToastHost({ ...none, [host]: true })).toBe(host);
    }
  );

  it('puts an incoming trade above Manage, Log and Tile info', () => {
    expect(getToastHost({ ...none, trade: true, manage: true })).toBe('trade');
    expect(getToastHost({ ...none, trade: true, log: true })).toBe('trade');
    expect(getToastHost({ ...none, trade: true, tile: true })).toBe('trade');
  });

  it('puts an auction above everything, including an open trade', () => {
    expect(getToastHost({ ...none, auction: true, manage: true })).toBe('auction');
    expect(getToastHost({ ...none, auction: true, trade: true, log: true })).toBe('auction');
  });
});
