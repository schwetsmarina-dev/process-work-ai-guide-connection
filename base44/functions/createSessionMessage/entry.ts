import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, mode_id, step_number, role, content, created_at } = await req.json();

    if (!session_id || !role || !content) {
      return Response.json({ error: 'Missing required fields: session_id, role, content' }, { status: 400 });
    }

    const sessions = await base44.asServiceRole.entities.Session.filter({ id: session_id });
    const session = sessions[0];

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Access denied: session does not belong to current user' }, { status: 403 });
    }

    // Persist the same owner id as the parent Session. This keeps Message RLS
    // consistent even though the record itself is created with service role.
    const now = created_at || new Date().toISOString();
    const message = await base44.asServiceRole.entities.Message.create({
      session_id,
      user_id: session.user_id,
      mode_id: mode_id || null,
      step_number: step_number || null,
      role,
      content,
      created_at: now,
    });

    if (role === 'user' && String(content || '').trim()) {
      const priorCount = Math.max(0, Number(session.user_message_count || 0));
      const firstMessage = priorCount === 0 && !session.first_user_message_at;
      const patch: Record<string, unknown> = { user_message_count: priorCount + 1 };
      if (firstMessage) {
        patch.first_user_message_at = now;
        patch.trial_consumed_at = now;
      }
      await base44.asServiceRole.entities.Session.update(session_id, patch);

      if (firstMessage) {
        await base44.asServiceRole.entities.UserJourneyEvent.create({
          user_id: session.user_id,
          user_email: String(user.email || '').toLowerCase(),
          event_type: 'session_first_message',
          session_id,
          mode_id: mode_id || session.mode_id || session.mode || '',
          step_number: Number(step_number || session.current_step || 1),
          occurred_at: now,
        }).catch((error) => console.warn('[createSessionMessage] journey event failed:', error?.message));
      }
    }

    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
