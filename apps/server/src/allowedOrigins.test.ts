import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_ORIGINS, resolveAllowedOrigins } from './allowedOrigins';

describe('resolveAllowedOrigins', () => {
  it('parses a comma-separated list, trimming blanks', () => {
    const { origins, warning } = resolveAllowedOrigins(' https://a.example , ,https://b.example ', {
      VERCEL_ENV: 'production',
    });
    expect(origins).toEqual(['https://a.example', 'https://b.example']);
    expect(warning).toBeUndefined();
  });

  it('falls back to local-dev origins without warning outside a deployment', () => {
    expect(resolveAllowedOrigins(undefined, {})).toEqual({ origins: DEFAULT_DEV_ORIGINS });
    expect(resolveAllowedOrigins('', { NODE_ENV: 'development' }).warning).toBeUndefined();
  });

  // The failure this guard exists for: a deployed server with no allowlist
  // serves only localhost origins, so every browser request from the real web
  // client fails CORS with no server-side error to point at it.
  it.each([
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'preview' },
    { RENDER: 'true' },
    { NODE_ENV: 'production' },
  ])('warns when unset in a deployed environment %j', (env) => {
    const { origins, warning } = resolveAllowedOrigins(undefined, env);
    expect(origins).toEqual(DEFAULT_DEV_ORIGINS);
    expect(warning).toMatch(/ALLOWED_ORIGINS/);
  });

  it('treats a whitespace/comma-only value as unset', () => {
    expect(resolveAllowedOrigins(' , ', { VERCEL_ENV: 'production' }).warning).toMatch(
      /ALLOWED_ORIGINS/
    );
  });
});
