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

    let language = 'es';
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
      console.warn('[generateProcessPractice] language lookup failed; defaulting to es:', e?.message);
    }

    let nodes = [];
    let edges = [];
    try {
      const mapRes = await base44.functions.invoke('buildLifeProcessMap', { user_id: userId, completed_only: true });
      nodes = Array.isArray(mapRes?.data?.nodes) ? mapRes.data.nodes : [];
      edges = Array.isArray(mapRes?.data?.edges) ? mapRes.data.edges : [];
    } catch (e) {
      console.warn('[generateProcessPractice] buildLifeProcessMap failed:', e?.message);
    }

    const allCompletedSessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: userId, status: 'completed' },
      '-created_date',
      30,
    );

    const requestedSourceIds = Array.isArray(body.source_session_ids)
      ? [...new Set(body.source_session_ids.map((id) => normalizeText(id)).filter(Boolean))]
      : [];
    const validOwnedIds = new Set(allCompletedSessions.map((session) => String(session.id)));
    const selectedSourceIds = requestedSourceIds.filter((id) => validOwnedIds.has(id));
    const hasSelectedTheme = selectedSourceIds.length >= 2;
    const sessions = hasSelectedTheme
      ? allCompletedSessions.filter((session) => selectedSourceIds.includes(String(session.id)))
      : allCompletedSessions.slice(0, 10);

    if (requestedSourceIds.length > 0 && selectedSourceIds.length !== requestedSourceIds.length) {
      return Response.json({ error: 'invalid_source_sessions' }, { status: 400 });
    }

    if (!forceTest && allCompletedSessions.length < MIN_COMPLETED_SESSIONS) {
      return Response.json({
        ready: false,
        confidence_score: 0,
        completed_sessions: allCompletedSessions.length,
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
      const existing = existingPractices.find((practice) => {
        if (!Array.isArray(practice.source_session_ids)) return false;
        if (hasSelectedTheme) {
          const existingIds = [...practice.source_session_ids].map(String).sort();
          const requestedIds = [...selectedSourceIds].map(String).sort();
          return existingIds.length === requestedIds.length
            && existingIds.every((id, index) => id === requestedIds[index]);
        }
        return practice.source_session_ids.includes(newestSessionId);
      });
      if (existing) {
        return Response.json({ ready: true, practice: existing, reused: true });
      }
    }
    const confidenceScore = scoreFromMap(nodes, edges, allCompletedSessions.length);
    if (!forceTest && !hasSelectedTheme && confidenceScore < READY_THRESHOLD) {
      return Response.json({ ready: false, confidence_score: confidenceScore });
    }

    const edgeRecurrenceStreak = edgeStreak(sessions);
    const suggestLiveFacilitator = edgeRecurrenceStreak >= EDGE_STREAK_THRESHOLD;
    const lowDataWarning = forceTest && (sessions.length === 0 || nodes.length === 0);
    const { label: clusterLabel, neighbors } = pickDominantCluster(nodes, edges);
    const selectedThemeLabel = hasSelectedTheme ? normalizeText(body.theme_label).slice(0, 160) : '';
    const selectedThemeObservation = hasSelectedTheme ? normalizeText(body.theme_observation).slice(0, 900) : '';

    const memories = await base44.asServiceRole.entities.UserMemory.filter(
      { user_id: userId, is_active: true },
      '-updated_at',
      20,
    );
    const memoryBlock = memories
      .map((memory) => `${normalizeText(memory.memory_key)}: ${normalizeText(memory.memory_value)}`)
      .filter(Boolean)
      .join('\n') || (language === 'es' ? '(no hay memoria guardada; ejecución de prueba)' : '(нет сохранённой памяти — тестовый прогон)');

    const sessionsBlock = sessions
      .map((session, index) => {
        const summary = normalizeText(session.summary) || (language === 'es' ? '(sin resumen)' : '(без summary)');
        const themes = (session.themes || []).map(normalizeText).filter(Boolean).join(', ');
        const signals = (session.signals || []).map(normalizeText).filter(Boolean).join(', ');
        const edgeSignals = (session.edge_signals || []).map(normalizeText).filter(Boolean).join(', ');
        const primary = (session.primary_process || []).map(normalizeText).filter(Boolean).join(', ');
        const secondary = (session.secondary_process || []).map(normalizeText).filter(Boolean).join(', ');
        return language === 'es'
          ? `Sesión ${index + 1} [${normalizeText(session.mode_id || session.mode)}]: ${summary} | temas: ${themes || '—'} | señales: ${signals || '—'} | señales de límite internas: ${edgeSignals || '—'} | proceso primario interno: ${primary || '—'} | proceso secundario interno: ${secondary || '—'}`
          : `Сессия ${index + 1} [${normalizeText(session.mode_id || session.mode)}]: ${summary} | темы: ${themes || '—'} | сигналы: ${signals || '—'} | край: ${edgeSignals || '—'} | первичный процесс: ${primary || '—'} | вторичный процесс: ${secondary || '—'}`;
      })
      .join('\n') || (language === 'es' ? '(no hay sesiones completadas; ejecución de prueba)' : '(нет завершённых сессий — тестовый прогон)');

    let terms = [];
    try {
      terms = await base44.asServiceRole.entities.Term.filter({ latin_key: { $in: TERM_KEYS } });
    } catch (e) {
      console.warn('[generateProcessPractice] glossary lookup failed:', e?.message);
    }
    const glossaryBlock = terms
      .map((term) => {
        const label = language === 'es' ? (term.term_es || term.term || term.latin_key) : (term.term || term.latin_key);
        const definition = language === 'es' ? (term.short_definition_es || term.short_definition) : term.short_definition;
        const application = language === 'es' ? (term.practical_application_es || term.practical_application) : term.practical_application;
        return `${normalizeText(term.latin_key)} — ${normalizeText(label)}: ${normalizeText(definition)}${application ? ` | ${language === 'es' ? 'Aplicación' : 'Применение'}: ${normalizeText(application)}` : ''}`;
      })
      .filter(Boolean)
      .join('\n') || (language === 'es' ? '(glosario no disponible)' : '(глоссарий недоступен)');

    const languageRule = language === 'es'
      ? 'Escribe TODO en español.'
      : language === 'en'
        ? 'Write everything in English.'
        : 'Пиши всё на русском языке.';

    // Retrieve by the same canonical Term.latin_key vocabulary used by Talvira's glossary.
    // This keeps technique selection tied to observed process concepts rather than loose hashtag matching.
    const detectedTermKeys = new Set();
    const sourceModes = sessions.map((session) => normalizeText(session.mode_id || session.mode).toLowerCase());
    const allSessionText = sessions.map(sessionEdgeText).join(' | ').toLowerCase();
    if (sessions.some((s) => (s.primary_process || []).length)) detectedTermKeys.add('primary_process');
    if (sessions.some((s) => (s.secondary_process || []).length)) detectedTermKeys.add('secondary_process');
    if (sessions.some((s) => (s.edge_signals || []).length) || EDGE_PATTERN.test(allSessionText)) detectedTermKeys.add('edge');
    if (sourceModes.some((mode) => /body|symptom|телес|симптом/.test(mode))) {
      detectedTermKeys.add('body_signal'); detectedTermKeys.add('proprioceptive_channel');
    }
    if (sourceModes.some((mode) => /dream|сон/.test(mode))) {
      detectedTermKeys.add('dreaming'); detectedTermKeys.add('visual_channel');
    }
    if (sourceModes.some((mode) => /conflict|relation|отнош|конфликт/.test(mode))) {
      detectedTermKeys.add('polarity'); detectedTermKeys.add('metacommunicator');
    }
    if (sourceModes.some((mode) => /journal|journaling|дневник/.test(mode))) detectedTermKeys.add('awareness');
    if (/симптом|symptom|боль|pain|напряж|tension/.test(allSessionText)) detectedTermKeys.add('symptom');
    if (/голос|voice|звук|sound|тон|tone|музык|music/.test(allSessionText)) detectedTermKeys.add('auditory_channel');
    if (/образ|image|цвет|color|рисун|draw|виден|vision/.test(allSessionText)) detectedTermKeys.add('visual_channel');
    if (/флирт|flirt|заигрыв|случайн|unexpected|синхрон/.test(allSessionText)) {
      detectedTermKeys.add('flirts'); detectedTermKeys.add('second_attention');
    }
    detectedTermKeys.add('integration');

    const canonicalTermKeys = [...detectedTermKeys];
    const allExercises = await base44.asServiceRole.entities.ProcessExercise.filter({ active: true }, 'exercise_id', 500).catch(() => []);
    const exerciseCandidates = allExercises
      .filter((item) => item.delivery_level !== 'live_specialist' && item.requires_live_facilitator !== true && item.intensity !== 'high' && (item.use_in || []).includes('personal_practice'))
      .map((item) => ({
        item,
        score: (item.term_keys || []).reduce((score, key) => score + (detectedTermKeys.has(String(key)) ? 1 : 0), 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.item);
    const eligibleExerciseIds = new Set(exerciseCandidates.map((item) => String(item.exercise_id)));
    const exerciseLibraryBlock = exerciseCandidates.map((item) => {
      const title = language === 'es' ? (item.title_es || item.title_ru) : item.title_ru;
      const purpose = language === 'es' ? (item.purpose_es || item.purpose) : item.purpose;
      const conditions = language === 'es' && Array.isArray(item.delivery_conditions_es)
        ? item.delivery_conditions_es : (item.delivery_conditions || []);
      const excludeIf = language === 'es' && Array.isArray(item.exclude_if_es)
        ? item.exclude_if_es : (item.exclude_if || []);
      const contraindications = language === 'es' && Array.isArray(item.contraindications_es)
        ? item.contraindications_es : (item.contraindications || []);
      const steps = language === 'es' && Array.isArray(item.steps_es) && item.steps_es.length === (item.steps || []).length
        ? item.steps_es : (item.steps || []);
      return language === 'es' ? [
        `${item.exercise_id} — ${title}`,
        `Term keys internos: ${(item.term_keys || []).join(', ')}`,
        `Objetivo: ${purpose}`,
        `Nivel de uso autónomo: ${item.delivery_level || 'conditional'}`,
        `Condiciones: ${conditions.join(' | ') || '—'}`,
        `No usar si: ${[...excludeIf, ...contraindications].join(', ') || '—'}`,
        `Secuencia: ${steps.join(' → ')}`,
      ].join('\n') : [
        `${item.exercise_id} — ${title}`,
        `Связанные term keys: ${(item.term_keys || []).join(', ')}`,
        `Назначение: ${purpose}`,
        `Уровень самостоятельности: ${item.delivery_level || 'conditional'}`,
        `Условия: ${conditions.join(' | ') || '—'}`,
        `Не предлагать при: ${[...excludeIf, ...contraindications].join(', ') || '—'}`,
        `Ход: ${steps.join(' → ')}`,
      ].join('\n');
    }).join('\n\n') || '—';

    const promptRu = `Ты — процессуально-ориентированный фасилитатор (Process Work / Арнольд Минделл). Построй персональную ПРОЦЕССУАЛЬНУЮ ПРАКТИКУ по материалу конкретного пользователя. Это не релаксационная медитация: цель — продолжить уже проявившийся процесс, не интерпретируя человека за него.

Глоссарий:
${glossaryBlock}

Повторяющаяся тема: ${selectedThemeLabel || clusterLabel || '(недостаточно данных — тестовый режим; не выдумывай персональные факты)'}
${selectedThemeObservation ? `Предварительное наблюдение по этой теме: ${selectedThemeObservation}\n` : ''}Связанные сигналы/темы: ${neighbors.join(', ') || '—'}

История завершённых сессий:
${sessionsBlock}

Активная память:
${memoryBlock}

КАНОНИЧЕСКИЕ ТЕРМИНЫ, ОБНАРУЖЕННЫЕ В МАТЕРИАЛЕ (внутренне): ${canonicalTermKeys.join(', ') || '—'}

БИБЛИОТЕКА ПРОВЕРЕННЫХ ПРОЦЕССУАЛЬНЫХ УПРАЖНЕНИЙ:
${exerciseLibraryBlock}

Использование библиотеки:
- Это методические опоры, а не обязательный сценарий.
- Выбери максимум 1–2 упражнения только если их логика действительно подтверждается материалом пользователя.
- Не копируй упражнение механически: адаптируй язык, интенсивность и канал под конкретный процесс.
- Авторство, source, название учебной/дипломной/сертификационной программы и любое происхождение упражнения — только внутренняя методическая информация. НИКОГДА не упоминай их в theme_label, offer_text, label или text любого шага и не говори пользователю, на какой программе/источнике основана практика.
- В эту выборку намеренно не попадают high-intensity упражнения, требующие живого фасилитатора.
- Если ни одно упражнение не подходит, не используй библиотеку и следуй процессу пользователя.
- Учитывай Уровень самостоятельности каждого упражнения. ai_self_guided можно предлагать самостоятельно. conditional используй только если контекст пользователя явно соответствует указанным условиям и нет ни одного сигнала из «Не предлагать при». live_specialist никогда не используй в персональной AI-практике.
- При сомнении между conditional и отказом от техники — не используй технику и выбери более мягкий способ продолжить процесс.
- Верни IDs реально использованных упражнений в used_exercise_ids (0–2); если не использовал — [].

СТРОГИЕ ПРАВИЛА:
1. Не называй это медитацией или расслабляющей визуализацией; это процессуальная практика.
2. Не диагностируй, не объясняй человеку его смысл и не добавляй биографические детали, которых нет в данных.
3. Вторичный процесс не навязывай. Используй приглашение: «если это движение продолжит разворачиваться…», «что могло бы появиться…» и т.п.
4. Если проявилась краевая фигура (например внутренний критик, запрещающий голос или часть, которая мешает/не позволяет), не обходи её. В рамках Process Work исходи из того, что эта фигура и её энергия имеют ценность для целостного процесса и потенциально несут полезное качество, силу, нужду или послание. Помоги посмотреть на неё с другой стороны и развернуть её к ресурсу/вторичному качеству; не позволяй практике застревать в страхе, негативной драматизации или борьбе с фигурой.
5. Для сильного края не давай директивы «пройти через него любой ценой». Оставляй человеку возможность уменьшить интенсивность, остановиться или вернуться к опоре.
6. exploration выбирай по доминирующему каналу: body→движение/ощущение, dream→образ/голос, conflict→роль/диалог, journaling/mixed→свободная ассоциация.
7. transition должен связать минимум два конкретных источника из разных фрагментов материала выше. Не выдумывай связь, если её нет.
7a. Если переданы конкретные source_session_ids и выбранная тема, работай ТОЛЬКО по этим сессиям. Название и observation — лишь навигация; если они не подтверждаются содержанием самих сессий, игнорируй неподтверждённую формулировку и опирайся на факты из сессий.
8. grounding — только контакт с телом и текущим окружением, без обещания успокоения.
9. Ровно семь шагов и строго в указанном порядке.
10. ${languageRule}
11. НИКОГДА не раскрывай пользователю source/provenance упражнений, названия учебных программ, школ, сертификаций или внутренних методических источников. Эти данные существуют только для внутреннего подбора техники.

Шаги:
1 grounding
2 contact
3 amplification
4 exploration
5 transition
6 secondary_process
7 integration

Каждый шаг — 1–3 коротких предложения, пригодных для естественного озвучивания. Не добавляй технических пометок, markdown или инструкции диктору в text.

Также верни theme_label (3–6 слов), dominant_channel (body/dream/conflict/journaling/mixed), offer_text (короткое приглашение без обещаний результата), used_exercise_ids (0–2 ID реально использованных упражнений).
Верни только JSON.`;

    const promptEs = `Eres una persona facilitadora orientada a Process Work (Arnold Mindell). Construye una PRÁCTICA PROCESUAL PERSONALIZADA a partir del material real de esta persona. No es una meditación de relajación: la finalidad es continuar un proceso que ya se ha manifestado sin interpretar a la persona por ella.

GLOSARIO INTERNO:
${glossaryBlock}

Tema recurrente: ${selectedThemeLabel || clusterLabel || '(datos insuficientes: modo de prueba; no inventes hechos personales)'}
${selectedThemeObservation ? `Observación preliminar sobre este tema: ${selectedThemeObservation}\n` : ''}Señales/temas relacionados: ${neighbors.join(', ') || '—'}

SESIONES COMPLETADAS:
${sessionsBlock}

MEMORIA ACTIVA:
${memoryBlock}

CLAVES CANÓNICAS DETECTADAS EN EL MATERIAL (solo uso interno): ${canonicalTermKeys.join(', ') || '—'}

BIBLIOTECA DE EJERCICIOS PROCESUALES:
${exerciseLibraryBlock}

USO DE LA BIBLIOTECA:
- Los ejercicios son apoyos metodológicos, no un guion obligatorio.
- Elige como máximo 1–2 solo cuando su lógica esté realmente respaldada por el material de la persona.
- No copies mecánicamente un ejercicio: adapta lenguaje, intensidad y vía de experiencia al proceso concreto.
- Autoría, source, programas de formación/certificación, escuelas y cualquier procedencia son información metodológica interna. NUNCA los menciones en theme_label, offer_text, label ni en el texto de ningún paso.
- La selección excluye deliberadamente ejercicios high-intensity y los que requieren una persona facilitadora en vivo.
- Si ningún ejercicio encaja, no uses la biblioteca y sigue el proceso de la persona.
- ai_self_guided puede utilizarse autónomamente. conditional solo cuando el contexto cumple claramente sus condiciones y no aparece ninguna señal de exclusión. live_specialist nunca se utiliza en una práctica AI personal.
- Ante la duda sobre un ejercicio conditional, omítelo y elige una continuación más suave.
- Devuelve en used_exercise_ids únicamente los IDs realmente utilizados (0–2); si no utilizas ninguno, devuelve [].

REGLAS ESTRICTAS:
1. No llames a esto meditación ni visualización de relajación; es una práctica procesual.
2. No diagnostiques, no expliques a la persona «lo que significa» su experiencia y no añadas detalles biográficos ausentes en los datos.
3. No impongas un proceso secundario. Formula invitaciones abiertas como «si este movimiento siguiera desplegándose…» o «¿qué podría aparecer…?».
4. Si aparece una figura que frena —por ejemplo una voz crítica, una parte prohibitiva o una parte que no permite avanzar— no la esquives. Explora su función y su energía como parte potencialmente significativa del proceso y pregunta si contiene alguna cualidad, fuerza, necesidad o mensaje útil. No conviertas la práctica en una batalla contra esa figura ni en dramatización negativa.
5. Ante un límite fuerte, nunca ordenes «atravesarlo». La persona debe poder reducir intensidad, detenerse o volver a un recurso.
6. Elige exploration según la vía dominante: body → movimiento/sensación; dream → imagen/voz; conflict → rol/diálogo; journaling/mixed → asociación libre y seguimiento de señales.
7. transition debe vincular al menos dos fuentes concretas de fragmentos distintos del material anterior. No inventes una conexión si no existe.
7a. Si se proporcionan source_session_ids concretos y un tema seleccionado, trabaja SOLO con esas sesiones. El nombre y la observación sirven para navegar; si no están respaldados por las sesiones, ignóralos y usa únicamente el material confirmado.
8. grounding significa contacto con el cuerpo y el entorno presente, sin prometer calma.
9. Deben existir exactamente siete pasos y en este orden.
10. Escribe TODO el contenido visible en español natural de España, tratando a la persona de tú.
11. NUNCA reveles procedencia de ejercicios, programas de formación, escuelas, certificaciones ni fuentes metodológicas internas.

PASOS:
1 grounding
2 contact
3 amplification
4 exploration
5 transition
6 secondary_process
7 integration

Cada paso debe tener 1–3 frases cortas, naturales y adecuadas para voz. No añadas marcas técnicas, markdown ni instrucciones para locución en text.

Devuelve también theme_label (3–6 palabras), dominant_channel (body/dream/conflict/journaling/mixed), offer_text (invitación breve sin prometer resultados) y used_exercise_ids (0–2 IDs realmente utilizados).
Devuelve únicamente JSON.`;

    const prompt = language === 'es' ? promptEs : promptRu;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        required: ['theme_label', 'dominant_channel', 'offer_text', 'used_exercise_ids', 'steps'],
        properties: {
          theme_label: { type: 'string' },
          dominant_channel: {
            type: 'string',
            enum: ['body', 'dream', 'conflict', 'journaling', 'mixed'],
          },
          offer_text: { type: 'string' },
          used_exercise_ids: { type: 'array', maxItems: 2, items: { type: 'string' } },
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

    const usedExerciseIds = Array.isArray(result.used_exercise_ids)
      ? result.used_exercise_ids.map((id) => normalizeText(id)).filter((id) => eligibleExerciseIds.has(id)).slice(0, 2)
      : [];
    const now = new Date().toISOString();
    const record = await base44.asServiceRole.entities.ProcessPractice.create({
      user_id: userId,
      language,
      is_test: forceTest,
      confidence_score: confidenceScore,
      theme_label: normalizeText(result.theme_label) || selectedThemeLabel || clusterLabel || 'process practice',
      dominant_channel: result.dominant_channel || 'mixed',
      source_session_ids: sessions.map((session) => session.id),
      exercise_ids: usedExerciseIds,
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
