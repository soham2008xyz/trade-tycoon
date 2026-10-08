/**
 * Number of proxies between the client and this app, for Express's
 * `trust proxy` setting. With N hops, `req.ip` is the Nth X-Forwarded-For
 * entry from the right — the address the outermost trusted proxy saw.
 *
 * It differs per host: Vercel has one, Render has several (measured, not
 * documented — see docs/DEPLOY.md → "Render standby"). Too low and `req.ip`
 * is an internal proxy address, so players share rate-limit buckets. Too
 * high and a client can mint a fresh bucket by prepending its own
 * X-Forwarded-For entries. Never `true`, for the same reason.
 */
export const parseTrustProxyHops = (value: string | undefined): number => {
  const trimmed = value?.trim();
  if (!trimmed) return 1;
  const hops = Number(trimmed);
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error(`TRUST_PROXY_HOPS must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return hops;
};
