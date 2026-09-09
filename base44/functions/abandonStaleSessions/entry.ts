import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STALE_HOURS = 24;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only this user's active sessions
    const active = await base44.entities.Session.filter({ status: 'active' }, '-created_date', 200);

    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
    const now = new Date().toISOString();
    const svc = base44.asServiceRole;
    let abandoned = 0;

    for (const s of active) {
      const started = new Date(s.started_at || s.created_date).getTime();
      if (!Number.isFinite(started) || started > cutoff) continue;
      await base44.entities.Session.update(s.id, { status: 'abandoned', ended_at: now }).catch(() => {});
      await svc.entities.UserJourneyEvent.create({
        user_id: user.id,
        user_email: String(user.email || '').toLowerCase(),
        event_type: 'session_abandoned',
        session_id: s.id,
        mode_id: s.mode_id || s.mode || '',
        step_number: Number(s.current_step || 0),
        occurred_at: now,
      }).catch((error) => console.warn('[abandonStaleSessions] journey event failed:', error?.message));
      abandoned++;
    }

    console.log('[abandonStaleSessions] completed', { checked: active.length, abandoned });
    return Response.json({ checked: active.length, abandoned });
  } catch (error) {
    console.error('[abandonStaleSessions] error:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});