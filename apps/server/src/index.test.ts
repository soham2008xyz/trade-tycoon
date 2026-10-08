import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './index';

describe('rate limiting behind a proxy', () => {
  // Vercel and Render both terminate requests at a proxy, so the socket peer
  // is the proxy and the real client is in X-Forwarded-For. Without
  // `trust proxy`, every player shares the proxy's single rate-limit bucket.
  it('gives each forwarded client IP its own bucket', async () => {
    const remaining = async (ip: string) => {
      const res = await request(app).get('/api/rooms').set('X-Forwarded-For', ip);
      return Number(res.headers['ratelimit-remaining']);
    };

    const first = await remaining('203.0.113.10');
    expect(await remaining('203.0.113.10')).toBe(first - 1);
    expect(await remaining('198.51.100.20')).toBe(first);
  });

  // A client can prepend anything to X-Forwarded-For; only the entry the
  // proxy appended is trustworthy. Trusting more than one hop (or `true`)
  // would hand out a fresh bucket for every spoofed prefix.
  it('ignores client-supplied X-Forwarded-For prefixes', async () => {
    const remaining = async (forwardedFor: string) => {
      const res = await request(app).get('/api/rooms').set('X-Forwarded-For', forwardedFor);
      return Number(res.headers['ratelimit-remaining']);
    };

    const first = await remaining('10.0.0.1, 192.0.2.30');
    expect(await remaining('10.0.0.2, 192.0.2.30')).toBe(first - 1);
  });
});
