/**
 * Google Analytics 4 for the web build (#334). Pure TS (NO React / react-native
 * / expo imports — see apps/client/AGENTS.md) so the no-op paths are testable
 * in node.
 *
 * Everything here is a no-op unless a valid measurement ID is configured AND a
 * browser `window` exists, so local dev (ID unset), native apps and the static
 * export's server render never load gtag or send anything.
 *
 * Never pass player names, room codes or session tokens as event params: the
 * token is a credential and the rest identifies people. Counts and modes only.
 */

type Gtag = (...args: unknown[]) => void;

/** The slice of `window` gtag needs; lets tests pass a fake. */
export interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: Gtag;
  location: { origin: string };
  document: {
    createElement(tag: 'script'): { async: boolean; src: string };
    head: { appendChild(node: unknown): unknown };
  };
}

// GA4 web stream IDs look like `G-XXXXXXXXXX`. Anything else is a typo in the
// deploy config; refusing it also keeps arbitrary text out of the script URL.
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

/** The configured ID if it is a well-formed GA4 ID, otherwise `null`. */
export function parseMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim().toUpperCase();
  return id && MEASUREMENT_ID_PATTERN.test(id) ? id : null;
}

export interface Analytics {
  /**
   * Loads gtag.js once. Safe to call repeatedly (effects run twice in dev).
   * The track calls run it themselves, so callers needn't order their effects
   * around it (a child's effect runs before its parent layout's).
   */
  init(): void;
  /** Records a virtual page view; the app's screens are not routes. */
  trackPageView(path: string, title: string): void;
  trackEvent(name: string, params?: Record<string, string | number | boolean>): void;
}

export function createAnalytics(
  measurementId: string | null,
  getWindow: () => AnalyticsWindow | undefined
): Analytics {
  let initialized = false;

  function init() {
    if (initialized || !measurementId) return;
    const win = getWindow();
    if (!win) return;
    initialized = true;

    // The standard gtag bootstrap: queue calls in dataLayer until the async
    // script arrives and drains it. gtag.js expects the `arguments` object
    // itself, not an array, which is why this isn't an arrow function.
    win.dataLayer = win.dataLayer ?? [];
    const dataLayer = win.dataLayer;
    win.gtag = function gtagShim() {
      dataLayer.push(arguments);
    };

    const script = win.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    win.document.head.appendChild(script);

    win.gtag('js', new Date());
    win.gtag('config', measurementId, {
      // Page views are sent by trackPageView per screen; the automatic one
      // would double-count the landing screen.
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  // Loads gtag on first use; stays a no-op when init bailed out.
  const gtag: Gtag = (...args) => {
    init();
    if (!initialized) return;
    getWindow()?.gtag?.(...args);
  };

  return {
    init,
    trackPageView(path, title) {
      const win = getWindow();
      if (!win) return;
      const page = { page_location: `${win.location.origin}${path}`, page_title: title };
      // The URL never changes, so without `set` GA would attribute every
      // later event to the landing page instead of the screen it fired on.
      gtag('set', page);
      gtag('event', 'page_view', page);
    },
    trackEvent(name, params) {
      gtag('event', name, params ?? {});
    },
  };
}

// `process.env.EXPO_PUBLIC_…` must be written out literally: Expo inlines it
// at build time only for this exact member expression, so changing the ID
// needs a rebuild and redeploy. React Native defines a global `window` too, so
// the browser check is on `document`.
export const analytics = createAnalytics(
  parseMeasurementId(process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID),
  () => (typeof document === 'undefined' ? undefined : (window as unknown as AnalyticsWindow))
);
