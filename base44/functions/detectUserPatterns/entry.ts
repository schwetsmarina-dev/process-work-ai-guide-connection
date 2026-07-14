import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// AI Pattern Detection
// Analyzes a single user's UserMemory + Insight records and detects recurring
// themes/patterns. Saves results as UserMemory rows with memory_type='detected_pattern',
// attributed to user_id, with an explanation of which sessions the pattern is based on.
//
// Can be called two ways:
//   1. { user_id: "<id>" }  — analyze one specific user
//   2. no payload / {}       — batch: analyze every user that has memories/insights
//      (used by the scheduled automation)

const MIN_SIGNALS = 4; // need at least this many memory+insight records to bother detecting

async function detectForUser(base44, userId) {
  // ── Gather this user's memories (exclude prior detected patterns) ──────────
  const memories = await base44.asServiceRole.entities.UserMemory.filter(
    { user_id: userId, is_active: true },
    '-updated_at',
    200
  );
  const sourceMemories = memories.filter((m) => m.memory_type !== 'detected_pattern');

  // ── Gather this user's insights (owned via created_by_id) ──────────────────
  const insights = await base44.asServiceRole.entities.Insight.filter(
    { user_id: userId, is_archived: false },
    '-created_date',
    200
  );

  const signalCount = sourceMemories.length + insights.length;
  if (signalCount < MIN_SIGNALS) {
    console.log('[detectUserPatterns] user', userId, '— too few signals:', signalCount, '— skipping');
    return { user_id: userId, skipped: true, reason: 'too_few_signals', signalCount };
  }

  // ── Build a compact analysis corpus ────────────────────────────────────────
  const memBlock = sourceMemories
    .map((m) => `- [${m.memory_type}] ${m.memory_value}${m.source_session_id ? ` (сессия ${m.source_session_id})` : ''}`)
    .join('\n');

  const insBlock = insights
    .map((i) => {
      const parts = [`- ${i.title}: ${i.insight_text}`];
      if (i.tags) parts.push(`теги: ${i.tags}`);
      if (i.state_keywords) parts.push(`состояния: ${i.state_keywords}`);
      if (i.process_layer) parts.push(`слой: ${i.process_layer}`);
      if (i.session_id) parts.push(`(сессия ${i.session_id})`);
      return parts.join(' | ');
    })
    .join('\n');

  let result;
  try {
    result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Ты — процессуально-ориентированный аналитик. Ниже — накопленная память и инсайты одного человека из разных сессий. Найди 1–4 ПОВТОРЯЮЩИХСЯ темы или паттерна, которые проявляются в нескольких записях (а не разовые события).

Для каждого паттерна:
- pattern: короткая безличная формулировка от третьего лица БЕЗ подлежащего (НЕ начинай с «Пользователь», «Человек», «Он», «Она»; на испанском — не начинай с «El usuario», «La persona», «Él», «Ella»). Пиши на том же языке, что и записи.
- explanation: 1–2 предложения — на основе чего выявлен паттерн (какие темы/состояния повторяются).
- session_ids: массив id сессий (из скобок «сессия ...»), в которых паттерн проявился. Если id не ясны — пустой массив.

Не выдумывай. Если явных повторов нет — верни пустой массив patterns.

ПАМЯТЬ:
${memBlock || '(нет)'}

ИНСАЙТЫ:
${insBlock || '(нет)'}`,
      response_json_schema: {
        type: 'object',
        properties: {
          patterns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
                explanation: { type: 'string' },
                session_ids: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    });
  } catch (e) {
    console.error('[detectUserPatterns] LLM failed for user', userId, '(silent):', e?.message);
    return { user_id: userId, error: 'llm_failed' };
  }

  const patterns = Array.isArray(result?.patterns) ? result.patterns.filter((p) => p?.pattern) : [];
  if (patterns.length === 0) {
    console.log('[detectUserPatterns] user', userId, '— no recurring patterns found');
    return { user_id: userId, saved: 0 };
  }

  // ── Replace previous detected patterns for this user (keep only latest run) ──
  const prior = memories.filter((m) => m.memory_type === 'detected_pattern');
  for (const row of prior) {
    await base44.asServiceRole.entities.UserMemory.update(row.id, { is_active: false }).catch(() => {});
  }

  const now = new Date().toISOString();
  let saved = 0;
  for (const p of patterns) {
    const sessionIds = Array.isArray(p.session_ids) ? p.session_ids.filter(Boolean) : [];
    const explanation = p.explanation
      ? `${p.explanation}${sessionIds.length ? ` (сессии: ${sessionIds.join(', ')})` : ''}`
      : '';
    // Store the explanation + source sessions in the memory_value tail so it
    // survives without any schema change.
    const value = explanation ? `${p.pattern}\n\nОснование: ${explanation}` : p.pattern;
    try {
      await base44.asServiceRole.entities.UserMemory.create({
        user_id: userId,
        memory_type: 'detected_pattern',
        memory_key: 'detected_pattern',
        memory_value: value,
        confidence: 0.7,
        importance: 'high',
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      saved++;
    } catch (writeErr) {
      console.error('[detectUserPatterns] write failed for user', userId, '—', writeErr?.message);
    }
  }

  console.log('[detectUserPatterns] user', userId, '— saved', saved, 'patterns');
  return { user_id: userId, saved };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Single-user mode
    if (body.user_id) {
      const res = await detectForUser(base44, body.user_id);
      return Response.json(res);
    }

    // Batch mode (scheduled): collect distinct user_ids from memories + insights
    const memories = await base44.asServiceRole.entities.UserMemory.list('-updated_at', 2000);
    const insights = await base44.asServiceRole.entities.Insight.list('-created_date', 2000);
    const userIds = [
      ...new Set([
        ...memories.map((m) => m.user_id).filter(Boolean),
        ...insights.map((i) => i.user_id).filter(Boolean),
      ]),
    ];

    console.log('[detectUserPatterns] batch — analyzing', userIds.length, 'users');
    const results = [];
    for (const uid of userIds) {
      results.push(await detectForUser(base44, uid));
    }

    return Response.json({ analyzed: userIds.length, results });
  } catch (error) {
    console.error('[detectUserPatterns] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});