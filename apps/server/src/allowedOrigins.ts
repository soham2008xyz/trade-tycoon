export const DEFAULT_DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

/** Hosts we deploy to set one of these; local dev and tests set none. */
const isDeployed = (env: NodeJS.ProcessEnv): boolean =>
  Boolean(env.VERCEL_ENV || env.RENDER) || env.NODE_ENV === 'production';

/**
 * Resolve the CORS allowlist from `ALLOWED_ORIGINS` (comma-separated).
 * Unset falls back to the localhost dev origins rather than `*` (CodeQL
 * js/cors-permissive-configuration). That's fine locally, but in a deployed
 * server it silently blocks the real web client, so we return a `warning` for
 * the caller to log at boot. It's a warning, not a throw: the API still works
 * for native apps, which aren't subject to CORS.
 */
export const resolveAllowedOrigins = (
  raw: string | undefined,
  env: NodeJS.ProcessEnv
): { origins: string[]; warning?: string } => {
  const configured = raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return { origins: configured };

  if (!isDeployed(env)) return { origins: DEFAULT_DEV_ORIGINS };
  return {
    origins: DEFAULT_DEV_ORIGINS,
    warning:
      'ALLOWED_ORIGINS is not set in a deployed environment; only localhost origins are ' +
      "allowed, so browsers on the real web client will fail CORS. Set it to the client's URL.",
  };
};
