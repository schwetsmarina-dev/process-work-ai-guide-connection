// Entitlement rules — pure functions, no I/O.
//
// Shared deliberately between the client and the backend so both answer
// "what is this person allowed to do?" the same way. The CLIENT copy decides
// what to RENDER. The authoritative answer always comes from the server:
// anything the browser computes can be edited by the person using the browser.
//
// Access model:
//   free  — trial. One session per mode, chat only. See FREE_FEATURES.
//   beta  — granted access (founding testers, invited therapists). Full, free.
//   paid  — active Stripe subscription. Full.
//
// expires_at === null means LIFETIME. Founding testers are recorded this way,
// so nothing about the paywall ever needs to special-case them.

export const PLANS = {
  FREE: "free",
  BETA: "beta",
  PAID: "paid",
};

/** Plans that unlock everything. */
const FULL_ACCESS_PLANS = new Set([PLANS.BETA, PLANS.PAID]);

/**
 * The trial: one session in each mode, so a person can try every mode before
 * deciding. Not a total count — the point is breadth, not volume.
 */
export const FREE_SESSIONS_PER_MODE = 1;

/**
 * Everything that can be gated. Kept as an explicit list so a new feature is
 * a deliberate decision rather than something that silently lands in the free
 * tier because nobody remembered to gate it.
 */
export const FEATURES = {
  CHAT: "chat", // running a session
  SUMMARY: "summary", // end-of-session summary
  INSIGHTS: "insights", // insight suggestions, saving, library
  REPORT: "report", // full report and PDF export
  MEMORY: "memory", // continuity between sessions
  ANALYTICS: "analytics", // progress, process map, timeline
  PHYSIO: "physio", // physiological data
};

/**
 * What the free trial includes: the conversation, and nothing else.
 *
 * The reasoning is not only commercial. Summaries, insights and cross-session
 * memory are what make the method cumulative, and they each cost an LLM call.
 * A trial should show what a session feels like, not deliver the full arc.
 */
const FREE_FEATURES = new Set([FEATURES.CHAT]);

/** True when the entitlement has not expired. Null expiry = lifetime. */
export function isCurrent(entitlement, now = new Date()) {
  if (!entitlement) return false;
  if (entitlement.status !== "active") return false;
  if (!entitlement.expires_at) return true; // lifetime
  return new Date(entitlement.expires_at) > now;
}

/** True for beta or paid — i.e. everything unlocked. */
export function hasFullAccess(entitlement, now = new Date()) {
  return isCurrent(entitlement, now) && FULL_ACCESS_PLANS.has(entitlement.plan);
}

/** The single question a screen should ask before showing a feature. */
export function canUseFeature(entitlement, feature, now = new Date()) {
  if (hasFullAccess(entitlement, now)) return true;
  return FREE_FEATURES.has(feature);
}

/**
 * Whether a free user may start another session in this mode.
 * @param {object} usageByMode - e.g. { body: 1, dream: 0 }
 */
export function canStartSessionInMode(entitlement, modeId, usageByMode = {}, now = new Date()) {
  if (hasFullAccess(entitlement, now)) return true;
  const used = Number(usageByMode?.[modeId] || 0);
  return used < FREE_SESSIONS_PER_MODE;
}

/** Free sessions left in a mode. Infinity for full access. */
export function freeSessionsLeft(entitlement, modeId, usageByMode = {}, now = new Date()) {
  if (hasFullAccess(entitlement, now)) return Infinity;
  const used = Number(usageByMode?.[modeId] || 0);
  return Math.max(0, FREE_SESSIONS_PER_MODE - used);
}

/** True for granted (non-paying) access — used to hide upgrade prompts. */
export function isGranted(entitlement) {
  return entitlement?.plan === PLANS.BETA;
}

/** Lifetime entitlements never need a renewal reminder. */
export function isLifetime(entitlement) {
  return Boolean(entitlement) && !entitlement.expires_at;
}

/** Days remaining, or null for lifetime / no entitlement. */
export function daysRemaining(entitlement, now = new Date()) {
  if (!entitlement || !entitlement.expires_at) return null;
  const ms = new Date(entitlement.expires_at) - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
}
