// Entitlement rules — pure functions, no I/O.
//
// Shared deliberately between the client and the backend so both answer
// "does this person have access?" the same way. The CLIENT copy is only ever
// used to decide what to render. The authoritative answer always comes from
// the server (see the getEntitlement backend function): anything the browser
// computes can be edited by the person using the browser.
//
// Access model:
//   free  — no paid access
//   beta  — granted access (testers, invited therapists). Free of charge.
//   paid  — active Stripe subscription
//
// expires_at === null means LIFETIME. Founding testers are recorded this way,
// so they keep access forever without any special-casing in the code.

export const PLANS = {
  FREE: "free",
  BETA: "beta",
  PAID: "paid",
};

/** Plans that unlock full access. */
const PAID_EQUIVALENT = new Set([PLANS.BETA, PLANS.PAID]);

/** True when the entitlement has not expired. Null expiry = lifetime. */
export function isCurrent(entitlement, now = new Date()) {
  if (!entitlement) return false;
  if (entitlement.status !== "active") return false;
  if (!entitlement.expires_at) return true; // lifetime
  return new Date(entitlement.expires_at) > now;
}

/** The single question the app asks. */
export function hasFullAccess(entitlement, now = new Date()) {
  return isCurrent(entitlement, now) && PAID_EQUIVALENT.has(entitlement.plan);
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
