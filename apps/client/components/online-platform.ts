export interface OnlinePlatformSnapshot {
  platform: string;
  expoPublicServerUrl?: string | null;
  eventSourceAvailable: boolean;
}

const IOS_SIMULATOR_SERVER_URL = 'http://127.0.0.1:3001';
const WEB_SERVER_URL = 'http://localhost:3001';
const ANDROID_EMULATOR_SERVER_URL = 'http://10.0.2.2:3001';

/**
 * Prefer the explicitly configured public server URL, otherwise choose the
 * right local development host for the current platform.
 */
export const getOnlineServerUrl = ({
  platform,
  expoPublicServerUrl,
}: Pick<OnlinePlatformSnapshot, 'platform' | 'expoPublicServerUrl'>): string => {
  const configuredUrl = expoPublicServerUrl?.trim();
  if (configuredUrl) return configuredUrl;
  if (platform === 'web') return WEB_SERVER_URL;
  if (platform === 'ios') return IOS_SIMULATOR_SERVER_URL;
  return ANDROID_EMULATOR_SERVER_URL;
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
