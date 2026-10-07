/**
 * Google Analytics 4 for the web build (#334). Pure TS (NO React / react-native
 * / expo imports — see apps/client/AGENTS.md) so the no-op paths are testable
 * in node.
 *
 * Everything here is a no-op unless a valid measurement ID is configured AND a
 * browser `document` exists, so local dev (ID unset), native apps and the static
 * export's server render never load gtag or send anything.
 *
 * Never pass player names, room codes or session tokens as event params: the
 * token is a credential and the rest identifies people. Counts and modes only.
 */

// Codacy runs ESLint's core `no-unused-vars`, which flags every parameter
// name in a type signature, so nothing here declares a type with function
// members. Tests pass a fake `Window` instead.
type AnalyticsWindow = Window & { dataLayer?: unknown[] };

// GA4 web stream IDs look like `G-XXXXXXXXXX`. Anything else is a typo in the
// deploy config; refusing it also keeps arbitrary text out of the script URL.
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

/** The configured ID if it is a well-formed GA4 ID, otherwise `null`. */
export function parseMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim().toUpperCase();
  return id && MEASUREMENT_ID_PATTERN.test(id) ? id : null;
}

export function createAnalytics(measurementId: string | null, getWindow: () => Window | undefined) {
  let dataLayer: unknown[] | null = null;

  // gtag.js only reads commands pushed as an `arguments` object (an array means
  // something else to it), so this pushes `arguments`, which mirrors `args`.
  function push(...args: unknown[]): void {
    if (!dataLayer || args.length === 0) return;
    dataLayer.push(arguments);
  }

  /**
   * Loads gtag.js once. Safe to call repeatedly (effects run twice in dev).
   * The track calls run it themselves, so callers needn't order their effects
   * around it (a child's effect runs before its parent layout's).
   */
  function init() {
    if (dataLayer !== null) return;
    if (!measurementId) return;
    const win: AnalyticsWindow | undefined = getWindow();
    if (!win) return;

    // The standard gtag bootstrap: queue commands in dataLayer until the async
    // script arrives and drains it.
    win.dataLayer = win.dataLayer ?? [];
    dataLayer = win.dataLayer;

    const script = win.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    win.document.head.appendChild(script);

    push('js', new Date());
    push('config', measurementId, {
      // Page views are sent by trackPageView per screen; the automatic one
      // would double-count the landing screen.
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  // Loads gtag on first use; stays a no-op when init bailed out.
  function gtag(...args: unknown[]): void {
    init();
    push(...args);
  }

  return {
    init,
    /** Records a virtual page view; the app's screens are not routes. */
    trackPageView(path: string, title: string): void {
      const win = getWindow();
      if (!win) return;
      const page = { page_location: `${win.location.origin}${path}`, page_title: title };
      // The URL never changes, so without `set` GA would attribute every
      // later event to the landing page instead of the screen it fired on.
      gtag('set', page);
      gtag('event', 'page_view', page);
    },
    trackEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
      gtag('event', name, params);
    },
  };
}

// `process.env.EXPO_PUBLIC_…` must be written out literally: Expo inlines it
// at build time only for this exact member expression, so changing the ID
// needs a rebuild and redeploy. React Native defines a global `window` too, so
// the browser check is on `document`.
export const analytics = createAnalytics(
  parseMeasurementId(process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID),
  () => (typeof document === 'undefined' ? undefined : window)
);
