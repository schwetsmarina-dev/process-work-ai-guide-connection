import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Creates a session, enforcing the free-trial quota server-side.
 *
 * WHY THIS EXISTS
 * Sessions used to be created directly from the browser. A paywall checked
 * only in the client is decoration: anyone can open the console and create
 * rows directly. Session create is therefore restricted to admins in the RLS
 * rules, and every session now comes through here, where the quota is checked
 * against data the caller cannot edit.
 *
 * Free trial: one session per mode (FREE_SESSIONS_PER_MODE in
 * src/lib/entitlement.js — keep the two in step).
 *
 * Body: {
 *   modeId: "body" | "dream" | "conflict" | "journaling",
 *   continuedFromSessionId?: string,   // carrying on from a previous session
 *   carryOverContext?: string
 * }
 * Returns: { session } or { blocked: true, reason: "quota" }
 */

const FREE_SESSIONS_PER_MODE = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const modeId = String(body?.modeId || '').trim();
    if (!modeId) {
      return Response.json({ error: 'modeId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const email = String(user.email || '').toLowerCase();
    const now = new Date();

    // ── Entitlement ──────────────────────────────────────────────────────────
    const rows = (await svc.entities.Entitlement.filter({ user_email: email })) || [];
    const hasFullAccess = rows.some(
      (e) =>
        e.status === 'active' &&
        (e.plan === 'beta' || e.plan === 'paid') &&
        (!e.expires_at || new Date(e.expires_at) > now),
    );

    // ── Quota, for free users only ───────────────────────────────────────────
    if (!hasFullAccess) {
      const sessions = (await svc.entities.Session.filter({ created_by_id: user.id })) || [];
      const usedInMode = sessions.filter((s) => (s.mode_id || s.mode) === modeId).length;

      if (usedInMode >= FREE_SESSIONS_PER_MODE) {
        console.log('[startSession] blocked by quota', { email, modeId, usedInMode });
        return Response.json({
          blocked: true,
          reason: 'quota',
          modeId,
          usedInMode,
          limit: FREE_SESSIONS_PER_MODE,
        });
      }
    }

    // ── Create ───────────────────────────────────────────────────────────────
    // created_by_id must be the USER, not the service role, or every RLS rule
    // that keys on ownership would stop matching.
    // Only these extras are accepted. Anything else the client sends is
    // ignored, so a crafted request cannot set status, dates or ownership.
    const extras = {};
    if (body?.continuedFromSessionId) {
      extras.continued_from_session_id = String(body.continuedFromSessionId);
    }
    if (body?.carryOverContext) {
      extras.carry_over_context = String(body.carryOverContext);
    }

    const session = await svc.entities.Session.create({
      ...extras,
      mode_id: modeId,
      mode: modeId,
      status: 'active',
      current_step: 1,
      created_by_id: user.id,
      created_by: user.email,
      user_id: user.id,
      started_at: new Date().toISOString(),
    });

    console.log('[startSession] created', {
      email,
      modeId,
      sessionId: session?.id,
      fullAccess: hasFullAccess,
    });

    return Response.json({ session });
  } catch (error) {
    console.error('[startSession] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
