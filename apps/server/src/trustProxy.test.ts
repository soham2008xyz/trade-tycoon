import { describe, expect, it } from 'vitest';
import { parseTrustProxyHops } from './trustProxy';

describe('parseTrustProxyHops', () => {
  it('defaults to one hop (Vercel) when unset or blank', () => {
    expect(parseTrustProxyHops(undefined)).toBe(1);
    expect(parseTrustProxyHops('')).toBe(1);
    expect(parseTrustProxyHops('  ')).toBe(1);
  });

  it('accepts a positive hop count', () => {
    expect(parseTrustProxyHops('3')).toBe(3);
    expect(parseTrustProxyHops(' 2 ')).toBe(2);
  });

  // A typo must fail loudly at boot: silently falling back to 1 would put
  // every player behind a multi-proxy host into a handful of shared buckets.
  it.each(['0', '-1', '1.5', 'true', 'abc'])('rejects %j', (value) => {
    expect(() => parseTrustProxyHops(value)).toThrow(/TRUST_PROXY_HOPS/);
  });
});
