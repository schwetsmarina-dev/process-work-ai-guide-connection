import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALLOWED_EVENTS = new Set([
  'app_opened',
  'onboarding_started',
  'onboarding_step_viewed',
  'onboarding_completed',
  'mode_opened',
  'session_created',
  'session_first_message',
  'session_step_advanced',
  'session_resumed',
  'session_completed',
  'session_abandoned',
  'abandonment_feedback_prompted',
  'abandonment_reason_submitted',
]);

const clean = (value, max = 120) => value == null ? undefined : String(value).trim().slice(0, max);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const eventType = clean(body.event_type, 80);
    if (!ALLOWED_EVENTS.has(eventType)) {
      return Response.json({ error: 'Unsupported event_type' }, { status: 400 });
    }

    const data = {
      user_id: user.id,
      user_email: String(user.email || '').toLowerCase(),
      event_type: eventType,
      occurred_at: new Date().toISOString(),
    };

    if (body.session_id) {
      const sessionId = clean(body.session_id, 120);
      const sessions = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      const session = sessions?.[0];
      if (!session || (session.user_id !== user.id && user.role !== 'admin')) {
        return Response.json({ error: 'Invalid session' }, { status: 403 });
      }
      data.session_id = sessionId;
    }
    if (body.mode_id) data.mode_id = clean(body.mode_id, 40);
    if (Number.isInteger(Number(body.step_number))) data.step_number = Math.max(0, Math.min(100, Number(body.step_number)));
    if (body.reason_code) data.reason_code = clean(body.reason_code, 80);
    if (body.language === 'ru' || body.language === 'es') data.language = body.language;

    const event = await base44.asServiceRole.entities.UserJourneyEvent.create(data);
    return Response.json({ ok: true, id: event?.id });
  } catch (error) {
    console.error('[logJourneyEvent] error:', error?.message);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});