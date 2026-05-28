import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { type } = await req.json();
    if (!type || !['sessions', 'messages', 'pdf'].includes(type)) {
      return Response.json({ error: 'Invalid type. Must be sessions, messages, or pdf.' }, { status: 400 });
    }

    const subs = await base44.entities.Subscription.filter({ user_email: user.email });
    const sub = subs[0];

    if (!sub) {
      // No subscription found — allow (auto-created by RequireAuth on login)
      console.warn('[SUBSCRIPTION_CHECK]', { user: user.email, type, status: 'no_subscription_found', allowed: true });
      return Response.json({ allowed: true, used: 0, limit: 999, remaining: 999, plan_type: 'FREE' });
    }

    const used = sub[`${type}_used`] || 0;
    const limit = sub[`${type}_limit`] || 999;
    const allowed = used < limit;
    const remaining = Math.max(0, limit - used);

    console.log('[SUBSCRIPTION_CHECK]', { user: user.email, type, used, limit, allowed, plan: sub.plan_type });

    if (!allowed) {
      console.log('[LIMIT_REACHED]', { user: user.email, type, used, limit, plan: sub.plan_type });
    }

    return Response.json({ allowed, used, limit, remaining, plan_type: sub.plan_type });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});