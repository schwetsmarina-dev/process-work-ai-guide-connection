import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Personal Process Practice generator.
//
// NOT a "meditation" — per Process Work logic, the goal is not to relax the
// person but to help them take the next step of a process that has already
// shown itself as recurring across sessions (primary process → edge →
// secondary process → integration), grounded in this user's own material.
//
// Two entry modes:
//  - force_test = true  → admin test button. Always generates, even with
//    thin/no data (low_data_warning=true in that case), ignoring the
//    confidence threshold. Marked is_test=true so it never surfaces to real
//    users mixed in with accepted practices.
//  - force_test = false → real flow (future in-app offer). Only generates
//    when confidence_score >= READY_THRESHOLD; otherwise returns
//    { ready: false } without creating a record.

const READY_THRESHOLD = 70;
const TERM_KEYS = ['primary_process', 'secondary_process', 'edge', 'amplification', 'channel', 'body_signal', 'consensus_reality'];
const EDGE_PATTERN = /край|edge|сопротивл|блок|стопор|не могу|избега|resisten|no puedo|bloque|evita/i;
const EDGE_STREAK_THRESHOLD = 3; // "стабильно повторяется несколько сессий подряд" — 3 последних подряд сессий подряд

// How many of the most recent sessions (starting from the newest) show an
// edge-type signal, counted as a STREAK from the most recent session
// backwards — stops at the first session without one. This deliberately
// requires *consecutive* recurrence, not just frequency, per the product
// rule: "a strong edge is one that keeps showing up session after session
// right now", not one that appeared a few times months ago.
function edgeStreak(sessions) {
  let streak = 0;
  for (const s of sessions) {
    const labels = [...(s.themes || []), ...(s.signals || [])];
    const hasEdge = labels.some((t) => EDGE_PATTERN.test(String(t)));
    if (hasEdge) streak++;
    else break;
  }
  return streak;
}

function liveFacilitatorNote(language) {
  if (language === 'es') {
    return 'Noto que, en tus últimas sesiones, aparece una y otra vez el mismo límite (edge). Una práctica grabada no puede leer lo que pasa contigo en tiempo real — así que, además de esta práctica, podría tener sentido explorarlo con un facilitador en vivo, si en algún momento te apetece. No es obligatorio — la práctica sigue estando disponible tal cual.';
  }
  if (language === 'en') {
    return "I'm noticing the same edge showing up session after session. A recorded practice can't read what's happening for you in real time — so alongside this practice, it might be worth exploring this with a live facilitator at some point, if that feels right. It's not required — the practice is still here either way.";
  }
  return 'Замечаю, что в последних сессиях один и тот же край повторяется снова и снова. Записанная практика не может считать то, что происходит с вами в реальном времени — поэтому, кроме этой практики, имеет смысл в какой-то момент пойти с этим к живому фасилитатору, если возникнет желание. Это не обязательно — практика всё равно остаётся доступна.';
}

function scoreFromMap(nodes, edges, sessionsCount) {
  if (!nodes.length) return 0;
  const themeOrSignal = nodes.filter((n) => n.type === 'theme' || n.type === 'signal');
  const dominant = [...themeOrSignal].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return 0;

  const recurrence = Math.min(50, (dominant.count - 1) * 25); // 2 occurrences=25, 3+=50
  const hasEdgeSignal = nodes.some((n) => /край|edge|сопротивл|resisten/i.test(n.label));
  const edgeBonus = hasEdgeSignal ? 20 : 0;
  const sessionsBonus = sessionsCount >= 3 ? 20 : sessionsCount === 2 ? 10 : 0;
  const strongEdges = edges.filter((e) => e.weight >= 2).length;
  const cohesionBonus = Math.min(10, strongEdges * 5);

  return Math.min(100, recurrence + edgeBonus + sessionsBonus + cohesionBonus);
}

function pickDominantCluster(nodes, edges) {
  const themeOrSignal = nodes.filter((n) => n.type === 'theme' || n.type === 'signal');
  if (!themeOrSignal.length) return { label: null, neighbors: [] };
  const dominant = [...themeOrSignal].sort((a, b) => b.count - a.count)[0];
  const neighborIds = new Set();
  for (const e of edges) {
    if (e.source === dominant.id) neighborIds.add(e.target);
    if (e.target === dominant.id) neighborIds.add(e.source);
  }
  const neighbors = nodes.filter((n) => neighborIds.has(n.id)).map((n) => n.label);
  return { label: dominant.label, neighbors };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const forceTest = !!body.force_test;

    // Resolve caller + target user (test button always targets the caller).
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (forceTest && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only for test generation' }, { status: 403 });
    }
    const userId = body.user_id || caller.id;

    // Language: from AppUser, default ru.
    let language = 'ru';
    try {
      const owners = await base44.asServiceRole.entities.AppUser.filter({ created_by_id: userId });
      if (owners[0]?.language) language = owners[0].language;
    } catch (e) {
      console.warn('[generateProcessPractice] could not resolve language, defaulting to ru:', e?.message);
    }

    // ── Step 1: recurring-pattern map (reuses buildLifeProcessMap — no logic duplication) ──
    let nodes = [];
    let edges = [];
    try {
      const mapRes = await base44.functions.invoke('buildLifeProcessMap', { user_id: userId });
      nodes = mapRes?.data?.nodes || [];
      edges = mapRes?.data?.edges || [];
    } catch (e) {
      console.warn('[generateProcessPractice] buildLifeProcessMap failed (continuing with empty map):', e?.message);
    }

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: userId, status: 'completed' },
      '-created_date',
      10
    );
    const confidenceScore = scoreFromMap(nodes, edges, sessions.length);
    const ready = forceTest || confidenceScore >= READY_THRESHOLD;

    if (!ready) {
      return Response.json({ ready: false, confidence_score: confidenceScore });
    }

    const lowDataWarning = forceTest && (sessions.length === 0 || nodes.length === 0);
    const { label: clusterLabel, neighbors } = pickDominantCluster(nodes, edges);

    // ── Step 2: gather supporting material ─────────────────────────────────
    const memories = await base44.asServiceRole.entities.UserMemory.filter({ user_id: userId, is_active: true }, '-updated_at', 20);
    const memoryBlock = memories.map((m) => `${m.memory_key}: ${m.memory_value}`).join('\n') || '(нет сохранённой памяти — тестовый прогон)';
    const sessionsBlock = sessions
      .map((s, i) => `Сессия ${i + 1} [${s.mode_id || s.mode}]: ${s.summary || '(без summary)'} | темы: ${(s.themes || []).join(', ')} | сигналы: ${(s.signals || []).join(', ')}`)
      .join('\n') || '(нет завершённых сессий — тестовый прогон)';

    // ── Step 3: ground the prompt in this user's own curated PW glossary ────
    let terms = [];
    try {
      terms = await base44.asServiceRole.entities.Term.filter({ latin_key: { $in: TERM_KEYS } });
    } catch (e) {
      console.warn('[generateProcessPractice] Term lookup failed:', e?.message);
    }
    const glossaryBlock = terms.map((t) => `${t.latin_key}: ${t.short_definition}`).join('\n');

    const languageRule =
      language === 'es'
        ? 'Escribe TODO en español.'
        : language === 'en'
        ? 'Write everything in English.'
        : 'Пиши на русском языке.';

    const prompt = `Ты — процессуально-ориентированный фасилитатор (Process Work / Арнольд Минделл). Твоя задача — построить ПЕРСОНАЛЬНУЮ ПРОЦЕССУАЛЬНУЮ ПРАКТИКУ (НЕ медитацию, НЕ визуализацию на расслабление). Цель практики — не успокоить человека, а помочь ему сделать следующий шаг процесса, который уже проявился как повторяющийся в его сессиях.

Глоссарий (используй эти понятия точно так, как они определены, не искажай):
${glossaryBlock}

Повторяющаяся тема (по данным карты процесса): ${clusterLabel || '(недостаточно данных — тестовый режим, придумай нейтральную заземляющую практику на основе того материала, что есть, и явно избегай специфичных утверждений о человеке)'}
Связанные сигналы/темы: ${neighbors.join(', ') || '—'}

История сессий:
${sessionsBlock}

Активная память пользователя:
${memoryBlock}

СТРОГИЕ ПРАВИЛА:
1. Никогда не называй это "медитацией" или "визуализацией для расслабления". Это "процессуальная практика" (personal process practice).
2. Не интерпретируй за человека. Формулируй вопросы, приглашающие его найти собственный смысл.
3. Шаг "вторичный процесс" — НИКОГДА директивно (запрещено "теперь почувствуйте свободу"). Только приглашающе: "если это движение продолжит разворачиваться..."
4. Тип вопроса на шаге "Исследование" выбери по доминирующему каналу: body→движение тела, dream→голос/образ, conflict→роль/диалог, journaling/mixed→свободная ассоциация.
5. ${languageRule}
6. Если данных мало (тестовый режим) — сделай практику нейтральной и заземляющей, НЕ выдумывай специфичные детали о человеке, которых нет в материале.

Структура (ровно 7 шагов, каждый — 1-3 коротких предложения, разговорный тон фасилитатора):
1. grounding — приземление, только тело, без психологии
2. contact — контакт с главным сигналом/симптомом из материала выше (не "представьте", а именно тем, что повторялось)
3. amplification — "Позвольте этому стать немного сильнее"
4. exploration — вопрос по каналу (см. правило 4)
5. transition — свяжи минимум 2 источника из разного материала выше (например тему из одной сессии + сигнал из другой) — это персонализация
6. secondary_process — приглашающая формулировка (см. правило 3)
7. integration — короткая, не больше 1-2 фраз, привязана к жизни

Также сгенерируй:
- theme_label — короткая рабочая метка темы (3-6 слов)
- dominant_channel — один из: body, dream, conflict, journaling, mixed
- offer_text — короткое сообщение-приглашение перед практикой в духе: "Замечаю, что в последних сессиях повторяется одна и та же динамика. Могу предложить персональную процессуальную практику. Она не интерпретирует и не ставит целью изменить вас — её задача помочь продолжить исследование того, что уже начало проявляться в нашей работе." (адаптируй под язык и материал, не копируй дословно)

Верни ТОЛЬКО JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          theme_label: { type: 'string' },
          dominant_channel: { type: 'string', enum: ['body', 'dream', 'conflict', 'journaling', 'mixed'] },
          offer_text: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', enum: ['grounding', 'contact', 'amplification', 'exploration', 'transition', 'secondary_process', 'integration'] },
                label: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const steps = Array.isArray(result?.steps) ? result.steps : [];
    const fullText = steps.map((s) => `${s.label ? s.label + '.\n' : ''}${s.text}`).join('\n\n');

    const now = new Date().toISOString();
    const record = await base44.asServiceRole.entities.ProcessPractice.create({
      user_id: userId,
      language,
      is_test: forceTest,
      confidence_score: confidenceScore,
      theme_label: result?.theme_label || clusterLabel || 'test practice',
      dominant_channel: result?.dominant_channel || 'mixed',
      source_session_ids: sessions.map((s) => s.id),
      offer_text: result?.offer_text || '',
      steps,
      full_text: fullText,
      low_data_warning: lowDataWarning,
      status: 'ready',
      audio_status: 'none',
      generated_at: now,
      created_at: now,
    });

    console.log('[generateProcessPractice] created practice', record.id, 'confidence:', confidenceScore, 'test:', forceTest, 'lowData:', lowDataWarning);
    return Response.json({ ready: true, practice: record });
  } catch (error) {
    console.error('[generateProcessPractice] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
