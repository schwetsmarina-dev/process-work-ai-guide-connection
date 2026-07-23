import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Authoritative access check.
 *
 * The client has the same rules in src/lib/entitlement.js, but only for
 * deciding what to render. Anything that actually costs money or unlocks
 * content must call THIS, because the browser can be edited by its owner.
 *
 * Returns { hasAccess, plan, status, expiresAt, isLifetime, source }.
 * Never throws for "no entitlement" — that is simply free access.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await base44.asServiceRole.entities.Entitlement.filter({
      user_email: user.email,
    });

    const now = new Date();

    // A person may accumulate more than one row over time — a founding beta
    // grant plus a later subscription, say. Take the best still-valid one
    // rather than the newest, so a lapsed subscription never cancels out a
    // lifetime grant.
    const valid = (rows || []).filter((e) => {
      if (e.status !== 'active') return false;
      if (!e.expires_at) return true;
      return new Date(e.expires_at) > now;
    });

    const rank = { paid: 3, beta: 2, free: 1 };
    valid.sort((a, b) => {
      const byPlan = (rank[b.plan] || 0) - (rank[a.plan] || 0);
      if (byPlan !== 0) return byPlan;
      // Prefer lifetime over dated.
      if (!a.expires_at) return -1;
      if (!b.expires_at) return 1;
      return new Date(b.expires_at) - new Date(a.expires_at);
    });

    const best = valid[0] || null;
    const hasAccess = Boolean(best) && (best.plan === 'paid' || best.plan === 'beta');

    return Response.json({
      hasAccess,
      plan: best?.plan || 'free',
      status: best?.status || 'active',
      expiresAt: best?.expires_at || null,
      isLifetime: Boolean(best) && !best.expires_at,
      source: best?.source || null,
    });
  } catch (error) {
    console.error('[getEntitlement] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
