import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const subs = await base44.entities.Subscription.filter({ user_email: user.email });
    const sub = subs[0] || null;

    console.log('[SUBSCRIPTION_CHECK]', { user: user.email, found: !!sub, plan: sub?.plan_type || 'none' });

    return Response.json({ subscription: sub });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});