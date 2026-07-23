import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only. Regenerates the AI summary for a single session via Claude.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.session_id;
    if (!sessionId) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const sessions = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
    const session = sessions[0];
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = await base44.asServiceRole.entities.Message.filter(
      { session_id: sessionId },
      'created_at',
      500
    );
    const conversation = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role === 'user' ? 'Человек' : 'Ассистент'}: ${m.content}`)
      .join('\n');

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      return Response.json({ error: 'No user messages — cannot summarize', messageCount: messages.length });
    }

    // Language must follow the SESSION OWNER, not the admin running this.
    // Without it, regenerating a Spanish user's summary silently replaced it
    // with Russian text.
    let language = 'ru';
    try {
      const owners = await base44.asServiceRole.entities.AppUser.filter({
        email: session.created_by,
      });
      if (owners[0]?.language === 'es') language = 'es';
    } catch (e) {
      console.warn('[regenerateSessionSummary] could not resolve owner language, defaulting to ru:', e?.message);
    }
    const languageRule =
      language === 'es'
        ? 'Escribe TODO en español. Sé concreto, nada de generalidades.'
        : 'Pishi po-russki. Bud konkretnym, ne obshchim.';
    console.log('[regenerateSessionSummary] language:', language);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Ты — процессуально-ориентированный фасилитатор. Проанализируй эту сессию и выдай ТОЛЬКО JSON без markdown:
{
  "summary": "связный абзац 3-5 предложений — что происходило, какой процесс разворачивался, к чему пришли",
  "themes": ["тема 1", "тема 2", "тема 3"],
  "signals": ["телесный или эмоциональный сигнал 1", "сигнал 2"],
  "next_step_suggestion": "одна конкретная рекомендация — что исследовать в следующий раз"
}
Пиши на том же языке, на котором шла сессия. ${languageRule}

Режим: ${session.mode_id || session.mode}

Сессия:
${conversation}`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          themes: { type: 'array', items: { type: 'string' } },
          signals: { type: 'array', items: { type: 'string' } },
          next_step_suggestion: { type: 'string' },
        },
      },
    });

    await base44.asServiceRole.entities.Session.update(sessionId, {
      summary: result.summary || session.summary,
      themes: result.themes || [],
      signals: result.signals || [],
      next_step_suggestion: result.next_step_suggestion || '',
    });

    console.log('[regenerateSessionSummary] done', { sessionId, messageCount: messages.length });
    return Response.json({ session_id: sessionId, messageCount: messages.length, summary: result.summary, themes: result.themes, signals: result.signals });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});