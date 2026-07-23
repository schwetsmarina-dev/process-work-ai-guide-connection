// Telemetry — error monitoring + product analytics.
//
// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY CONTRACT (read before adding any call site)
//
// This app processes special-category data under GDPR Art. 9 (mental
// wellbeing). Therefore telemetry here is deliberately constrained:
//
//   1. NO session content ever leaves the app. Not messages, not summaries,
//      not insights, not journal text, not crisis snippets.
//   2. NO user identifiers are sent — no email, no user id, no name.
//      Retention/uniqueness is resolved server-side by the analytics provider
//      without cookies, so there is no client-side identity to leak.
//   3. Only events on the EVENTS allowlist are transmitted. Anything else is
//      dropped (and warned about in dev).
//   4. Event properties are sanitized: primitives only, short strings only,
//      and any key whose name looks like content/PII is dropped outright.
//
// These are enforced in code below, not by convention, because a call site
// added in a hurry six months from now must not be able to break it.
//
// Because no cookies and no personal data are used, this setup does not
// require a consent banner — which is also why it was chosen.
// ─────────────────────────────────────────────────────────────────────────────
//
// Configuration (Base44 app settings → env):
//   VITE_SENTRY_DSN        — enables error monitoring. Absent → no-op.
//   VITE_ANALYTICS_DOMAIN  — site domain registered with the analytics
//                            provider, e.g. "pwguide.uwu.ai". Absent → no-op.
//   VITE_ANALYTICS_SRC     — script URL of the analytics provider.
//                            Defaults to Plausible cloud (EU-hosted).
//   VITE_APP_VERSION       — optional release tag for Sentry.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ANALYTICS_DOMAIN = import.meta.env.VITE_ANALYTICS_DOMAIN;
const ANALYTICS_SRC =
  import.meta.env.VITE_ANALYTICS_SRC || "https://plausible.io/js/script.js";
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
const IS_DEV = import.meta.env.DEV;

/**
 * Allowlist of product events.
 *
 * Doubles as the project's tracking plan — the document funding bodies and
 * technical due diligence ask for. Keep names stable; adding is cheap,
 * renaming breaks historical funnels.
 */
export const EVENTS = {
  // Acquisition
  LANDING_VIEWED: "landing_viewed",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",

  // Activation
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // Core value loop
  SESSION_STARTED: "session_started",
  SESSION_STEP_ADVANCED: "session_step_advanced",
  SESSION_COMPLETED: "session_completed",
  SESSION_ABANDONED: "session_abandoned",

  // Retention / depth
  SUMMARY_VIEWED: "summary_viewed",
  INSIGHT_SAVED: "insight_saved",
  JOURNAL_ENTRY_CREATED: "journal_entry_created",
  FEEDBACK_SUBMITTED: "feedback_submitted",

  // Safety (counts only — never content)
  SAFETY_PAUSE_TRIGGERED: "safety_pause_triggered",
};

const ALLOWED_EVENTS = new Set(Object.values(EVENTS));

// Property keys that must never be transmitted, regardless of value.
const DENIED_KEY_PATTERN =
  /(text|message|content|body|prompt|answer|reply|summary|insight|note|journal|email|name|phone|address|token|user_?id|created_by)/i;

const MAX_STRING_LENGTH = 40;

/**
 * Keep only short primitives with safe key names.
 * Anything else is silently dropped — failing closed is the point.
 */
function sanitizeProps(props) {
  const clean = {};
  if (!props || typeof props !== "object") return clean;

  for (const [key, value] of Object.entries(props)) {
    if (DENIED_KEY_PATTERN.test(key)) continue;

    if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = value;
    } else if (typeof value === "boolean") {
      clean[key] = value;
    } else if (typeof value === "string" && value.length <= MAX_STRING_LENGTH) {
      clean[key] = value;
    }
    // objects, arrays, long strings, null, undefined → dropped
  }
  return clean;
}

// ── Error monitoring ────────────────────────────────────────────────────────

let sentry = null;

async function initSentry() {
  if (!SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: SENTRY_DSN,
      release: APP_VERSION,
      environment: IS_DEV ? "development" : "production",
      tracesSampleRate: 0.1,

      // Never attach IP, cookies, headers or request bodies.
      sendDefaultPii: false,

      // Session Replay is deliberately NOT enabled. Recording a screen where
      // someone writes about their inner life would be indefensible.

      beforeBreadcrumb(breadcrumb) {
        // The app still contains many console.log calls that may include
        // session text. Console and network breadcrumbs are dropped so that
        // content cannot reach Sentry through the back door.
        if (breadcrumb.category === "console") return null;
        if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
          return { ...breadcrumb, data: { ...breadcrumb.data, body: undefined } };
        }
        return breadcrumb;
      },

      beforeSend(event) {
        // Strip anything that could carry user content.
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          delete event.request.headers;
          if (event.request.url) {
            event.request.url = event.request.url.split("?")[0];
          }
        }
        delete event.user;
        return event;
      },

      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured",
      ],
    });
    sentry = Sentry;
  } catch (e) {
    // Monitoring must never break the app.
    // eslint-disable-next-line no-console
    console.warn("[telemetry] Sentry init failed:", e?.message);
  }
}

// ── Product analytics ───────────────────────────────────────────────────────

function initAnalytics() {
  if (!ANALYTICS_DOMAIN || typeof document === "undefined") return;
  if (document.querySelector("script[data-telemetry='analytics']")) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = ANALYTICS_SRC;
  script.setAttribute("data-domain", ANALYTICS_DOMAIN);
  script.setAttribute("data-telemetry", "analytics");
  script.onerror = () => {
    // eslint-disable-next-line no-console
    console.warn("[telemetry] analytics script blocked or unavailable");
  };
  document.head.appendChild(script);

  // Queue stub so events fired before the script loads are not lost.
  window.plausible =
    window.plausible ||
    function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function initTelemetry() {
  initSentry();
  initAnalytics();
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.info(
      `[telemetry] sentry=${SENTRY_DSN ? "on" : "off"} analytics=${
        ANALYTICS_DOMAIN ? "on" : "off"
      }`,
    );
  }
}

/** Report a caught error. Always logs locally; forwards when configured. */
export function captureError(error, context = {}) {
  // eslint-disable-next-line no-console
  console.error("[telemetry] error:", error?.message || error, context);
  if (sentry) {
    sentry.captureException(error, { extra: sanitizeProps(context) });
  }
}

/**
 * Record a product event.
 * @param {string} event - must be a value from EVENTS
 * @param {object} [props] - short primitives only; see sanitizeProps
 */
export function track(event, props = {}) {
  if (!ALLOWED_EVENTS.has(event)) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[telemetry] blocked unknown event "${event}" — add it to EVENTS first`,
      );
    }
    return;
  }

  const safeProps = sanitizeProps(props);

  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.info("[telemetry] event:", event, safeProps);
  }

  if (ANALYTICS_DOMAIN && typeof window !== "undefined" && window.plausible) {
    try {
      window.plausible(event, { props: safeProps });
    } catch {
      /* analytics must never break the app */
    }
  }
}
