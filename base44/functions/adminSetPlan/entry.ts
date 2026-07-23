import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Grants access to one person. Admin only.
 *
 * This is the manual lever: it decides, per person, whether a new tester gets
 * lifetime access or access until a date. Everyone already in the database
 * when payments were introduced is handled separately by
 * grantFoundingTesters — this function is for people who arrive afterwards.
 *
 * Body:
 *   {
 *     email:   "person@example.com",   // required
 *     plan:    "beta" | "paid" | "free",
 *     days:    30,        // optional. Omit or null => LIFETIME
 *     note:    "invited therapist, Tenerife pilot",
 *     revoke:  false      // true => sets status "revoked" instead
 *   }
 *
 * Idempotent per (email, source): re-running updates the existing grant rather
 * than stacking duplicates.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const plan = body?.plan || 'beta';
    const days = body?.days === undefined || body?.days === null ? null : Number(body.days);
    const note = body?.note || '';
    const revoke = Boolean(body?.revoke);

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }
    if (!['free', 'beta', 'paid'].includes(plan)) {
      return Response.json({ error: 'plan must be free, beta or paid' }, { status: 400 });
    }
    if (days !== null && (!Number.isFinite(days) || days <= 0)) {
      return Response.json({ error: 'days must be a positive number or omitted for lifetime' }, { status: 400 });
    }

    // null => lifetime. This is the whole mechanism; there is no separate flag.
    const expiresAt =
      days === null ? null : new Date(Date.now() + days * 86400000).toISOString();

    const svc = base44.asServiceRole.entities.Entitlement;
    const existing = await svc.filter({ user_email: email, source: 'admin' });

    const payload = {
      user_email: email,
      plan,
      status: revoke ? 'revoked' : 'active',
      expires_at: expiresAt,
      source: 'admin',
      note,
      granted_by: user.email,
    };

    let record;
    if (existing && existing.length > 0) {
      record = await svc.update(existing[0].id, payload);
      // Clean up any accidental duplicates from earlier runs.
      for (const dup of existing.slice(1)) {
        await svc.delete(dup.id).catch(() => {});
      }
    } else {
      record = await svc.create(payload);
    }

    console.log('[adminSetPlan]', {
      email,
      plan,
      lifetime: expiresAt === null,
      expiresAt,
      revoke,
      by: user.email,
    });

    return Response.json({
      ok: true,
      email,
      plan,
      lifetime: expiresAt === null,
      expiresAt,
      status: payload.status,
      id: record?.id,
    });
  } catch (error) {
    console.error('[adminSetPlan] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
