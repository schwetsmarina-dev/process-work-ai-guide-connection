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
    // NOTE: look up via created_by_id, not session.created_by (email) —
    // session.created_by is stamped with the SERVICE ROLE's identity since
    // sessions are created server-side (startSession), so it never resolves
    // to a real AppUser. AppUser rows are created client-side, so their own
    // created_by_id still correctly reflects the real user.
    let language = 'ru';
    try {
      const owners = await base44.asServiceRole.entities.AppUser.filter({
        created_by_id: session.user_id,
      });
      if (owners[0]?.language === 'es') language = 'es';
    } catch (e) {
      console.warn('[regenerateSessionSummary] could not resolve owner language, defaulting to ru:', e?.message);
    }
    const languageRule =
      language === 'es'
        ? 'Escribe TODO en español. Sé concreto, nada de generalidades.'
        : 'Пиши на русском языке. Будь конкретным, не общим.';
    console.log('[regenerateSessionSummary] language:', language);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Ты — процессуально-ориентированный фасилитатор. Проанализируй эту сессию и выдай ТОЛЬКО JSON без markdown:
{
  "summary": "связный абзац 3-5 предложений — что происходило, какой процесс разворачивался, к чему пришли",
  "themes": ["тема 1", "тема 2", "тема 3"],
  "signals": ["телесный или эмоциональный сигнал 1", "сигнал 2"],
  "edge_signals": ["короткое описание момента с внутренним критиком/стыдом/зацикливанием/отрицанием идентичности, если такой момент был (иначе пустой массив)"]
}
ВНУТРЕННЕЕ ПОЛЕ edge_signals (для аналитики терапевта, не показывается клиенту): заполняй только если в транскрипте был момент с признаками: резкое падение энергии, нервный смех, стыд/смущение, зацикливание без развития, отрицание идентичности, цитирование внутреннего запрета. Короткие фразы, без слова «край»/«граница»/«limite»/«borde». Если таких моментов не было — пустой массив [].

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
          edge_signals: { type: 'array', items: { type: 'string' } },
          next_step_suggestion: { type: 'string' },
        },
      },
    });

    const edgeSignals = Array.isArray(result.edge_signals) ? result.edge_signals.filter(Boolean) : [];
    await base44.asServiceRole.entities.Session.update(sessionId, {
      summary: result.summary || session.summary,
      themes: result.themes || [],
      signals: result.signals || [],
      edge_signals: edgeSignals,
      edge_signal_count: edgeSignals.length,
      next_step_suggestion: result.next_step_suggestion || '',
    });

    console.log('[regenerateSessionSummary] done', { sessionId, messageCount: messages.length });
    return Response.json({ session_id: sessionId, messageCount: messages.length, summary: result.summary, themes: result.themes, signals: result.signals });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});