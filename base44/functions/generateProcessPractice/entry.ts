import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Personalized Process Work practice generator.
// This is intentionally not a generic relaxation meditation. It builds a
// seven-step recorded practice from recurring material already present in the
// user's completed sessions and memory.

const READY_THRESHOLD = 70;
const MIN_COMPLETED_SESSIONS = 3;
const TERM_KEYS = [
  'primary_process',
  'secondary_process',
  'edge',
  'amplification',
  'channel',
  'body_signal',
  'consensus_reality',
];
const EXPECTED_STEP_KEYS = [
  'grounding',
  'contact',
  'amplification',
  'exploration',
  'transition',
  'secondary_process',
  'integration',
];
const EDGE_STREAK_THRESHOLD = 3;
const EDGE_PATTERN = /край|edge|сопротивл|блок|стопор|не могу|избега|внутренн(?:ий|яя|ее)?\s+(?:критик|голос|част)|критик|запрещ|не позволяет|мешает|resisten|no puedo|bloque|evita|cr[ií]tic[oa]\s+interior|voz\s+interior|no me permite/i;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sessionEdgeText(session) {
  return [
    ...(session.themes || []),
    ...(session.signals || []),
    session.summary,
    session.primary_process,
    session.secondary_process,
    session.next_step_suggestion,
  ]
    .filter(Boolean)
    .join(' | ');
}

function edgeStreak(sessions) {
  let streak = 0;
  for (const session of sessions) {
    if (EDGE_PATTERN.test(sessionEdgeText(session))) streak += 1;
    else break;
  }
  return streak;
}

function liveFacilitatorNote(language) {
  if (language === 'es') {
    return 'Noto que, en tus últimas sesiones, aparece una y otra vez el mismo límite. Una práctica grabada no puede leer lo que pasa contigo en tiempo real; si alguna vez te apetece, también podría tener sentido explorarlo con un facilitador en vivo. No es obligatorio: la práctica sigue estando disponible.';
  }
  if (language === 'en') {
    return "The same edge seems to be recurring across your recent sessions. A recorded practice cannot read what is happening for you in real time, so it may also be useful to explore it with a live facilitator at some point if you want to. That is optional; the practice remains available.";
  }
  return 'В последних сессиях один и тот же край повторяется снова и снова. Записанная практика не может считывать происходящее с тобой в реальном времени, поэтому, если захочешь, это также можно исследовать с живым фасилитатором. Это не обязательно: практика всё равно остаётся доступна.';
}

function scoreFromMap(nodes, edges, sessionsCount) {
  if (!nodes.length) return 0;
  const candidates = nodes.filter((node) => node.type === 'theme' || node.type === 'signal');
  const dominant = [...candidates].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  if (!dominant) return 0;

  const recurrence = Math.min(50, Math.max(0, (Number(dominant.count || 0) - 1) * 25));
  const hasEdgeSignal = nodes.some((node) => EDGE_PATTERN.test(String(node.label || '')));
  const edgeBonus = hasEdgeSignal ? 20 : 0;
  const sessionsBonus = sessionsCount >= 3 ? 20 : sessionsCount === 2 ? 10 : 0;
  const strongEdges = edges.filter((edge) => Number(edge.weight || 0) >= 2).length;
  const cohesionBonus = Math.min(10, strongEdges * 5);
  return Math.min(100, recurrence + edgeBonus + sessionsBonus + cohesionBonus);
}

function pickDominantCluster(nodes, edges) {
  const candidates = nodes.filter((node) => node.type === 'theme' || node.type === 'signal');
  if (!candidates.length) return { label: null, neighbors: [] };
  const dominant = [...candidates].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  const neighborIds = new Set();
  for (const edge of edges) {
    if (edge.source === dominant.id) neighborIds.add(edge.target);
    if (edge.target === dominant.id) neighborIds.add(edge.source);
  }
  return {
    label: normalizeText(dominant.label),
    neighbors: nodes.filter((node) => neighborIds.has(node.id)).map((node) => normalizeText(node.label)).filter(Boolean),
  };
}

function validateGeneratedPractice(result) {
  if (!result || typeof result !== 'object') return { ok: false, reason: 'empty_llm_result' };
  const steps = Array.isArray(result.steps) ? result.steps : [];
  if (steps.length !== EXPECTED_STEP_KEYS.length) {
    return { ok: false, reason: `invalid_step_count:${steps.length}` };
  }

  for (let i = 0; i < EXPECTED_STEP_KEYS.length; i += 1) {
    const step = steps[i] || {};
    if (step.key !== EXPECTED_STEP_KEYS[i]) {
      return { ok: false, reason: `invalid_step_order:${i}:${step.key || 'missing'}` };
    }
    if (!normalizeText(step.text)) {
      return { ok: false, reason: `empty_step_text:${step.key}` };
    }
  }

  const fullText = steps
    .map((step) => `${normalizeText(step.label) ? `${normalizeText(step.label)}.\n` : ''}${normalizeText(step.text)}`)
    .join('\n\n')
    .trim();

  if (fullText.length < 120) return { ok: false, reason: 'practice_too_short' };
  return { ok: true, steps, fullText };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const forceTest = body.force_test === true;
    if (forceTest && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only for test generation' }, { status: 403 });
    }

    if (!forceTest) {
      const entitlementRes = await base44.functions.invoke('getEntitlement', {});
      const entitlement = entitlementRes?.data || entitlementRes;
      if (!entitlement?.hasAccess) {
        return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });
      }
    }

    // Critical privacy boundary: service-role reads below can see any user's
    // sessions. A normal caller must never be allowed to choose another user_id.
    const requestedUserId = normalizeText(body.user_id);
    if (requestedUserId && requestedUserId !== caller.id && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: cannot generate a practice for another user' }, { status: 403 });
    }
    const userId = caller.role === 'admin' && requestedUserId ? requestedUserId : caller.id;

    let language = 'ru';
    try {
      // AppUser ownership is canonical by email; created_by_id is not reliable
      // for records created through older onboarding flows.
      const ownersByEmail = caller.email
        ? await base44.asServiceRole.entities.AppUser.filter({ email: caller.email })
        : [];
      const owners = ownersByEmail.length
        ? ownersByEmail
        : await base44.asServiceRole.entities.AppUser.filter({ created_by_id: userId });
      if (['ru', 'es', 'en'].includes(owners[0]?.language)) language = owners[0].language;
    } catch (e) {
      console.warn('[generateProcessPractice] language lookup failed; defaulting to ru:', e?.message);
    }

    let nodes = [];
    let edges = [];
    try {
      const mapRes = await base44.functions.invoke('buildLifeProcessMap', { user_id: userId });
      nodes = Array.isArray(mapRes?.data?.nodes) ? mapRes.data.nodes : [];
      edges = Array.isArray(mapRes?.data?.edges) ? mapRes.data.edges : [];
    } catch (e) {
      console.warn('[generateProcessPractice] buildLifeProcessMap failed:', e?.message);
    }

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: userId, status: 'completed' },
      '-created_date',
      10,
    );

    if (!forceTest && sessions.length < MIN_COMPLETED_SESSIONS) {
      return Response.json({
        ready: false,
        confidence_score: 0,
        completed_sessions: sessions.length,
        required_sessions: MIN_COMPLETED_SESSIONS,
      });
    }

    // Double clicks and overlapping browser requests must not create duplicate
    // practices (or duplicate paid TTS work) for the same newest session.
    const newestSessionId = sessions[0]?.id || null;
    if (!forceTest && newestSessionId) {
      const existingPractices = await base44.asServiceRole.entities.ProcessPractice.filter(
        { user_id: userId, is_test: false },
        '-generated_at',
        10,
      );
      const existing = existingPractices.find((practice) =>
        Array.isArray(practice.source_session_ids)
        && practice.source_session_ids.includes(newestSessionId)
      );
      if (existing) {
        return Response.json({ ready: true, practice: existing, reused: true });
      }
    }
    const confidenceScore = scoreFromMap(nodes, edges, sessions.length);
    if (!forceTest && confidenceScore < READY_THRESHOLD) {
      return Response.json({ ready: false, confidence_score: confidenceScore });
    }

    const edgeRecurrenceStreak = edgeStreak(sessions);
    const suggestLiveFacilitator = edgeRecurrenceStreak >= EDGE_STREAK_THRESHOLD;
    const lowDataWarning = forceTest && (sessions.length === 0 || nodes.length === 0);
    const { label: clusterLabel, neighbors } = pickDominantCluster(nodes, edges);

    const memories = await base44.asServiceRole.entities.UserMemory.filter(
      { user_id: userId, is_active: true },
      '-updated_at',
      20,
    );
    const memoryBlock = memories
      .map((memory) => `${normalizeText(memory.memory_key)}: ${normalizeText(memory.memory_value)}`)
      .filter(Boolean)
      .join('\n') || '(нет сохранённой памяти — тестовый прогон)';

    const sessionsBlock = sessions
      .map((session, index) => {
        const summary = normalizeText(session.summary) || '(без summary)';
        const themes = (session.themes || []).map(normalizeText).filter(Boolean).join(', ');
        const signals = (session.signals || []).map(normalizeText).filter(Boolean).join(', ');
        const edgeSignals = (session.edge_signals || []).map(normalizeText).filter(Boolean).join(', ');
        const primary = (session.primary_process || []).map(normalizeText).filter(Boolean).join(', ');
        const secondary = (session.secondary_process || []).map(normalizeText).filter(Boolean).join(', ');
        return `Сессия ${index + 1} [${normalizeText(session.mode_id || session.mode)}]: ${summary} | темы: ${themes || '—'} | сигналы: ${signals || '—'} | край: ${edgeSignals || '—'} | первичный процесс: ${primary || '—'} | вторичный процесс: ${secondary || '—'}`;
      })
      .join('\n') || '(нет завершённых сессий — тестовый прогон)';

    let terms = [];
    try {
      terms = await base44.asServiceRole.entities.Term.filter({ latin_key: { $in: TERM_KEYS } });
    } catch (e) {
      console.warn('[generateProcessPractice] glossary lookup failed:', e?.message);
    }
    const glossaryBlock = terms
      .map((term) => `${normalizeText(term.latin_key)}: ${normalizeText(term.short_definition)}`)
      .filter(Boolean)
      .join('\n') || '(глоссарий недоступен)';

    const languageRule = language === 'es'
      ? 'Escribe TODO en español.'
      : language === 'en'
        ? 'Write everything in English.'
        : 'Пиши всё на русском языке.';

    const prompt = `Ты — процессуально-ориентированный фасилитатор (Process Work / Арнольд Минделл). Построй персональную ПРОЦЕССУАЛЬНУЮ ПРАКТИКУ по материалу конкретного пользователя. Это не релаксационная медитация: цель — продолжить уже проявившийся процесс, не интерпретируя человека за него.

Глоссарий:
${glossaryBlock}

Повторяющаяся тема: ${clusterLabel || '(недостаточно данных — тестовый режим; не выдумывай персональные факты)'}
Связанные сигналы/темы: ${neighbors.join(', ') || '—'}

История завершённых сессий:
${sessionsBlock}

Активная память:
${memoryBlock}

СТРОГИЕ ПРАВИЛА:
1. Не называй это медитацией или расслабляющей визуализацией; это процессуальная практика.
2. Не диагностируй, не объясняй человеку его смысл и не добавляй биографические детали, которых нет в данных.
3. Вторичный процесс не навязывай. Используй приглашение: «если это движение продолжит разворачиваться…», «что могло бы появиться…» и т.п.
4. Если проявилась краевая фигура (например внутренний критик, запрещающий голос или часть, которая мешает/не позволяет), не обходи её. Исследуй её функцию, качество, голос, движение или послание, не объявляя её врагом и не пытаясь уничтожить.
5. Для сильного края не давай директивы «пройти через него любой ценой». Оставляй человеку возможность уменьшить интенсивность, остановиться или вернуться к опоре.
6. exploration выбирай по доминирующему каналу: body→движение/ощущение, dream→образ/голос, conflict→роль/диалог, journaling/mixed→свободная ассоциация.
7. transition должен связать минимум два конкретных источника из разных фрагментов материала выше. Не выдумывай связь, если её нет.
8. grounding — только контакт с телом и текущим окружением, без обещания успокоения.
9. Ровно семь шагов и строго в указанном порядке.
10. ${languageRule}

Шаги:
1 grounding
2 contact
3 amplification
4 exploration
5 transition
6 secondary_process
7 integration

Каждый шаг — 1–3 коротких предложения, пригодных для естественного озвучивания. Не добавляй технических пометок, markdown или инструкции диктору в text.

Также верни theme_label (3–6 слов), dominant_channel (body/dream/conflict/journaling/mixed), offer_text (короткое приглашение без обещаний результата).
Верни только JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        required: ['theme_label', 'dominant_channel', 'offer_text', 'steps'],
        properties: {
          theme_label: { type: 'string' },
          dominant_channel: {
            type: 'string',
            enum: ['body', 'dream', 'conflict', 'journaling', 'mixed'],
          },
          offer_text: { type: 'string' },
          steps: {
            type: 'array',
            minItems: 7,
            maxItems: 7,
            items: {
              type: 'object',
              required: ['key', 'text'],
              properties: {
                key: { type: 'string', enum: EXPECTED_STEP_KEYS },
                label: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const validated = validateGeneratedPractice(result);
    if (!validated.ok) {
      console.error('[generateProcessPractice] invalid LLM output:', validated.reason);
      return Response.json(
        { error: 'Generated practice failed structural validation', reason: validated.reason },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const record = await base44.asServiceRole.entities.ProcessPractice.create({
      user_id: userId,
      language,
      is_test: forceTest,
      confidence_score: confidenceScore,
      theme_label: normalizeText(result.theme_label) || clusterLabel || 'process practice',
      dominant_channel: result.dominant_channel || 'mixed',
      source_session_ids: sessions.map((session) => session.id),
      offer_text: normalizeText(result.offer_text),
      steps: validated.steps,
      full_text: validated.fullText,
      low_data_warning: lowDataWarning,
      edge_recurrence_streak: edgeRecurrenceStreak,
      suggest_live_facilitator: suggestLiveFacilitator,
      live_facilitator_note: suggestLiveFacilitator ? liveFacilitatorNote(language) : '',
      status: 'ready',
      audio_status: 'none',
      generated_at: now,
      created_at: now,
    });

    console.log('[generateProcessPractice] created', {
      confidenceScore,
      isTest: forceTest,
      edgeRecurrenceStreak,
    });
    return Response.json({ ready: true, practice: record });
  } catch (error) {
    console.error('[generateProcessPractice] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
