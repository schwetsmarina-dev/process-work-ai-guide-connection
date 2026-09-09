import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REASONS = new Set([
  'completed_suitable_place',
  'questions_repeated',
  'unclear',
  'unsuitable_direction',
  'emotional_or_physical_discomfort',
  'interrupted',
  'continue_same_place',
]);

async function hasUserContent(svc, session) {
  if (Number(session?.user_message_count || 0) > 0 || session?.first_user_message_at) return true;
  const rows = await svc.entities.Message.filter(
    { session_id: session.id, role: 'user' },
    '-created_date',
    1,
  );
  return Array.isArray(rows) && rows.some((row) => String(row?.content || '').trim());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'pending');
    const svc = base44.asServiceRole;
    const email = String(user.email || '').toLowerCase();

    if (action === 'pending') {
      const abandoned = (await svc.entities.Session.filter(
        { user_id: user.id, status: 'abandoned' },
        '-created_date',
        100,
      )) || [];

      let pending = null;
      for (const session of abandoned) {
        if (session.abandonment_reason || session.abandonment_feedback_at) continue;
        if (await hasUserContent(svc, session)) {
          pending = session;
          break;
        }
      }
      if (!pending) return Response.json({ session: null });

      const now = new Date().toISOString();
      if (!pending.abandonment_feedback_requested_at) {
        await svc.entities.Session.update(pending.id, { abandonment_feedback_requested_at: now });
        await svc.entities.UserJourneyEvent.create({
          user_id: user.id,
          user_email: email,
          event_type: 'abandonment_feedback_prompted',
          session_id: pending.id,
          mode_id: pending.mode_id || pending.mode || '',
          step_number: Number(pending.current_step || 0),
          occurred_at: now,
        }).catch((error) => console.warn('[abandonmentFollowUp] prompt event failed:', error?.message));
      }
      return Response.json({
        session: {
          id: pending.id,
          mode_id: pending.mode_id || pending.mode || '',
          current_step: Number(pending.current_step || 0),
          started_at: pending.started_at || pending.created_date || null,
        },
      });
    }

    if (action === 'submit') {
      const sessionId = String(body?.session_id || '').trim();
      const reason = String(body?.reason || '').trim();
      if (!sessionId || !REASONS.has(reason)) {
        return Response.json({ error: 'Invalid session_id or reason' }, { status: 400 });
      }
      const sessions = await svc.entities.Session.filter({ id: sessionId });
      const session = sessions?.[0];
      if (!session || (session.user_id !== user.id && user.role !== 'admin')) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!(await hasUserContent(svc, session))) {
        return Response.json({ error: 'Empty sessions do not accept abandonment feedback' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const patch = {
        abandonment_reason: reason,
        abandonment_feedback_at: now,
      };
      if (reason === 'continue_same_place') {
        patch.status = 'active';
        patch.ended_at = null;
      }
      await svc.entities.Session.update(session.id, patch);
      await svc.entities.UserJourneyEvent.create({
        user_id: session.user_id,
        user_email: email,
        event_type: 'abandonment_reason_submitted',
        session_id: session.id,
        mode_id: session.mode_id || session.mode || '',
        step_number: Number(session.current_step || 0),
        reason_code: reason,
        occurred_at: now,
      }).catch((error) => console.warn('[abandonmentFollowUp] submit event failed:', error?.message));

      return Response.json({ ok: true, continue_session: reason === 'continue_same_place' });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[abandonmentFollowUp] error:', error?.message);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});