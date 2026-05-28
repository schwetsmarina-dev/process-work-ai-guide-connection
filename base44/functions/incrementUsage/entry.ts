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
      console.warn('[USAGE_INCREMENT]', { user: user.email, type, status: 'no_subscription_found' });
      return Response.json({ success: false, reason: 'no_subscription' });
    }

    const currentUsed = sub[`${type}_used`] || 0;
    const newUsed = currentUsed + 1;

    await base44.entities.Subscription.update(sub.id, { [`${type}_used`]: newUsed });

    console.log('[USAGE_INCREMENT]', { user: user.email, type, used: newUsed, limit: sub[`${type}_limit`] });

    return Response.json({ success: true, used: newUsed, limit: sub[`${type}_limit`] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});