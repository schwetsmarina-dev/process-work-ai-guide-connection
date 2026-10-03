import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STALE_HOURS = 24;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only the authenticated user's active sessions. This must stay explicitly
    // scoped even for admins: an admin opening Talvira must never sweep other
    // users' sessions and attribute their abandonment event to the admin.
    const active = await base44.asServiceRole.entities.Session.filter(
      { status: 'active', user_id: user.id },
      '-created_date',
      200,
    );

    // Inactivity is a pause, not evidence that the person abandoned the process.
    // Keep sessions resumable. Follow-up asks the person what happened.
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
    let paused = 0;
    for (const s of active) {
      const lastMessages = await base44.asServiceRole.entities.Message.filter(
        { session_id: s.id }, '-created_date', 1,
      );
      const last = lastMessages?.[0];
      const lastActivity = Date.parse(last?.created_at || last?.created_date || s.started_at || s.created_date);
      if (Number.isFinite(lastActivity) && lastActivity <= cutoff) paused++;
    }
    console.log('[abandonStaleSessions] checked pauses', { checked: active.length, paused });
    return Response.json({ checked: active.length, abandoned: 0, paused });
  } catch (error) {
    console.error('[abandonStaleSessions] error:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});