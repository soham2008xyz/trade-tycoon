export interface OnlinePlatformSnapshot {
  platform: string;
  expoPublicServerUrl?: string | null;
  eventSourceAvailable: boolean;
  isDev: boolean;
}

const IOS_SIMULATOR_SERVER_URL = 'http://127.0.0.1:3001';
const WEB_SERVER_URL = 'http://localhost:3001';
const ANDROID_EMULATOR_SERVER_URL = 'http://10.0.2.2:3001';

/**
 * Prefer the explicitly configured public server URL. Failing that:
 *  - in dev, fall back to the right local host for the current platform
 *    (simulator/emulator loopback addresses) — there's no way to guess a
 *    real server URL for local development, so a hardcoded default is fine.
 *  - in production, guessing localhost would make online play silently fail
 *    with no visible cause on a build that forgot to set the env var. Web
 *    falls back to a same-origin relative URL instead (the common case of
 *    client and server sharing one deployment); native has no "same origin"
 *    to fall back to, so an unconfigured production native build returns
 *    `null` and the caller must surface a configuration error rather than
 *    guess.
 */
export const getOnlineServerUrl = ({
  platform,
  expoPublicServerUrl,
  isDev,
}: Pick<OnlinePlatformSnapshot, 'platform' | 'expoPublicServerUrl' | 'isDev'>): string | null => {
  const configuredUrl = expoPublicServerUrl?.trim();
  if (configuredUrl) return configuredUrl;

  if (isDev) {
    if (platform === 'web') return WEB_SERVER_URL;
    if (platform === 'ios') return IOS_SIMULATOR_SERVER_URL;
    return ANDROID_EMULATOR_SERVER_URL;
  }

  return platform === 'web' ? '' : null;
};

/**
 * Browser builds can keep using SSE. Native falls back to periodic reconnect
 * snapshots because EventSource is not available there today.
 */
export const supportsOnlineEventStream = ({
  platform,
  eventSourceAvailable,
}: Pick<OnlinePlatformSnapshot, 'platform' | 'eventSourceAvailable'>): boolean => {
  return platform === 'web' && eventSourceAvailable;
};
