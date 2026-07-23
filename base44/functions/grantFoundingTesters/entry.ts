import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time backfill: gives every person already registered when payments were
 * introduced a LIFETIME free entitlement.
 *
 * These are the people who tested the product before it was worth paying for.
 * Their access is recorded as plan "beta" with expires_at = null, which the
 * rules in src/lib/entitlement.js read as lifetime. Nothing about the paywall
 * ever needs to special-case them.
 *
 * Safe to run more than once: existing founding grants are left untouched and
 * counted as "skipped".
 *
 * Body (optional):
 *   { dryRun: true }  // report what WOULD happen and change nothing
 *
 * Run this BEFORE switching Stripe to live mode.
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
    const dryRun = Boolean(body?.dryRun);

    const appUsers = await base44.asServiceRole.entities.AppUser.list();
    const svc = base44.asServiceRole.entities.Entitlement;

    const granted = [];
    const skipped = [];
    const failed = [];

    for (const appUser of appUsers || []) {
      const email = String(appUser.email || '').trim().toLowerCase();
      if (!email) {
        skipped.push({ id: appUser.id, reason: 'no email' });
        continue;
      }

      try {
        const existing = await svc.filter({ user_email: email, source: 'beta_grant' });
        if (existing && existing.length > 0) {
          skipped.push({ email, reason: 'already a founding tester' });
          continue;
        }

        if (dryRun) {
          granted.push({ email, dryRun: true });
          continue;
        }

        await svc.create({
          user_email: email,
          plan: 'beta',
          status: 'active',
          expires_at: null, // lifetime
          source: 'beta_grant',
          note: 'Founding tester — lifetime access',
          granted_by: user.email,
        });
        granted.push({ email });
      } catch (e) {
        console.warn('[grantFoundingTesters] failed for', email, e?.message);
        failed.push({ email, error: e?.message });
      }
    }

    console.log('[grantFoundingTesters] done', {
      dryRun,
      granted: granted.length,
      skipped: skipped.length,
      failed: failed.length,
    });

    return Response.json({
      ok: true,
      dryRun,
      totals: { granted: granted.length, skipped: skipped.length, failed: failed.length },
      granted,
      skipped,
      failed,
    });
  } catch (error) {
    console.error('[grantFoundingTesters] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
