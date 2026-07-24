import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Authoritative access state: what this person is entitled to, and how much of
 * the free trial they have already used.
 *
 * The client has the same rules in src/lib/entitlement.js, but only for
 * deciding what to render. Anything that unlocks content or costs money must
 * call THIS, because the browser can be edited by its owner.
 *
 * Returns:
 *   { hasAccess, plan, status, expiresAt, isLifetime, source, usageByMode }
 *
 * usageByMode counts sessions already started per mode, which is what the free
 * trial is measured in (one session per mode).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Entitlements are keyed by email, which is how AppUser access is decided
    // everywhere else in this app. user_id is matched too when present, so a
    // record created by a backend job that only knew the id still resolves.
    const byEmail = await base44.asServiceRole.entities.Entitlement.filter({
      user_email: String(user.email || '').toLowerCase(),
    });
    let rows = byEmail || [];
    if (user.id) {
      const byId = await base44.asServiceRole.entities.Entitlement.filter({
        user_id: user.id,
      });
      const seen = new Set(rows.map((r) => r.id));
      for (const r of byId || []) if (!seen.has(r.id)) rows.push(r);
    }

    const now = new Date();

    // A person may accumulate more than one row over time — a founding beta
    // grant plus a later subscription, say. Take the best still-valid one
    // rather than the newest, so a lapsed subscription never cancels out a
    // lifetime grant.
    const valid = rows.filter((e) => {
      if (e.status !== 'active') return false;
      if (!e.expires_at) return true;
      return new Date(e.expires_at) > now;
    });

    const rank = { paid: 3, beta: 2, free: 1 };
    valid.sort((a, b) => {
      const byPlan = (rank[b.plan] || 0) - (rank[a.plan] || 0);
      if (byPlan !== 0) return byPlan;
      if (!a.expires_at) return -1;
      if (!b.expires_at) return 1;
      return new Date(b.expires_at) - new Date(a.expires_at);
    });

    const best = valid[0] || null;
    const hasAccess = Boolean(best) && (best.plan === 'paid' || best.plan === 'beta');

    // Trial usage. Only needed for free users, but returned always so the UI
    // can show "1 of 1 used" consistently.
    const usageByMode = {};
    try {
      const sessions = await base44.asServiceRole.entities.Session.filter({
        created_by_id: user.id,
      });
      for (const s of sessions || []) {
        const mode = s.mode_id || s.mode;
        if (!mode) continue;
        usageByMode[mode] = (usageByMode[mode] || 0) + 1;
      }
    } catch (e) {
      console.warn('[getEntitlement] could not count sessions:', e?.message);
    }

    return Response.json({
      hasAccess,
      plan: best?.plan || 'free',
      status: best?.status || 'active',
      expiresAt: best?.expires_at || null,
      isLifetime: Boolean(best) && !best.expires_at,
      source: best?.source || null,
      usageByMode,
    });
  } catch (error) {
    console.error('[getEntitlement] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
