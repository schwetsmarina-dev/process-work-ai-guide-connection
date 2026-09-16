import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function detectEdgeFigure(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const ruFigure = /(?:мужик|мужчина|женщина|фигура|голос|часть)/iu.test(raw);
  const ruFunction = /(?:говорит|ругает|требует|запрещает|не разрешает|не позволяет|мешает|останавливает|критикует|осуждает|обзывает)/iu.test(raw);
  const esFigure = /(?:voz|figura|parte|hombre|mujer)/iu.test(raw);
  const esFunction = /(?:dice|critica|juzga|prohíbe|exige|no me deja|no me permite|me frena|me impide)/iu.test(raw);
  if ((ruFigure && ruFunction) || (esFigure && esFunction)) return raw.slice(0, 500);
  return null;
}

function detectEdgeSignal(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const hasBlocking = /(?:запрещает|не разрешает|не позволяет|мешает|останавливает|критикует|осуждает|ругает|обзывает|стыд|страх|боюсь|prohíbe|no me deja|no me permite|me impide|me frena|critica|juzga|vergüenza|miedo)/iu.test(raw);
  return hasBlocking ? raw.slice(0, 500) : null;
}

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
      const edgeFigure = detectEdgeFigure(content);
      const edgeSignal = detectEdgeSignal(content);
      if (edgeFigure || edgeSignal) {
        const freshRows = await base44.asServiceRole.entities.Session.filter({ id: session_id });
        const fresh = freshRows?.[0] || session;
        if (edgeFigure) {
          const figures = Array.isArray(fresh.edge_figures) ? fresh.edge_figures.filter(Boolean) : [];
          if (!figures.some((value) => String(value).toLowerCase() === edgeFigure.toLowerCase())) figures.push(edgeFigure);
          patch.edge_figures = figures.slice(-12);
        }
        if (edgeSignal) {
          const signals = Array.isArray(fresh.edge_signals) ? fresh.edge_signals.filter(Boolean) : [];
          if (!signals.some((value) => String(value).toLowerCase() === edgeSignal.toLowerCase())) signals.push(edgeSignal);
          patch.edge_signals = signals.slice(-12);
        }
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
