// Minimal telemetry seam.
//
// Instrumentation points ship NOW; real providers are dropped in LATER by
// setting env vars — no changes needed at call sites. Until then everything is
// a safe no-op (plus a local console log), so the app runs with no external
// account or secret required.
//
// To enable in production:
//   • Error monitoring  → set VITE_SENTRY_DSN and initialize Sentry in initTelemetry()
//   • Product analytics → set VITE_ANALYTICS_KEY and forward events in track()

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ANALYTICS_KEY = import.meta.env.VITE_ANALYTICS_KEY;
const IS_DEV = import.meta.env.DEV;

export function initTelemetry() {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.info("[telemetry] init — no provider configured (no-op)");
  }
  // When VITE_SENTRY_DSN is set:
  //   import * as Sentry from "@sentry/react";
  //   Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1 });
}

// Report a caught error. Always logs locally; forwards when a provider is set.
export function captureError(error, context = {}) {
  // eslint-disable-next-line no-console
  console.error("[telemetry] error:", error?.message || error, context);
  if (SENTRY_DSN) {
    // Sentry.captureException(error, { extra: context });
  }
}

// Record a product event (funnels, retention). No-op until analytics configured.
export function track(event, props = {}) {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.info("[telemetry] event:", event, props);
  }
  if (ANALYTICS_KEY) {
    // forward to analytics provider (PostHog / Plausible / GA)
  }
}
