import { base44 } from "@/api/base44Client";

/**
 * Starts a session through the backend, which enforces the free-trial quota.
 *
 * Sessions can no longer be created directly from the browser: Session create
 * is admin-only in the RLS rules, and this function is the only door. Call it
 * everywhere a session begins.
 *
 * @returns {Promise<{session?: object, blocked?: boolean, reason?: string, modeId?: string}>}
 *   `session` on success, or `blocked: true` when the free trial for this mode
 *   is used up. Callers should show the upgrade prompt on `blocked`.
 */
export async function startSession(modeId, opts = {}) {
  const payload = { modeId };
  if (opts.continuedFromSessionId) payload.continuedFromSessionId = opts.continuedFromSessionId;
  if (opts.carryOverContext) payload.carryOverContext = opts.carryOverContext;

  const res = await base44.functions.invoke("startSession", payload);
  const data = res?.data ?? res;

  if (data?.blocked) {
    return { blocked: true, reason: data.reason, modeId: data.modeId };
  }
  if (!data?.session) {
    throw new Error(data?.error || "Could not start the session");
  }
  return { session: data.session };
}
