import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Analyze the session transcript via Claude → structured memory items.
// Silent: any failure returns [] and logs, never throws.
async function extractMemories(base44, messages) {
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
    .join('\n');

  if (!conversation.trim()) {
    console.log('[persistSessionMemory] empty conversation — nothing to analyze');
    return [];
  }

  let result;
  try {
    console.log('[persistSessionMemory] Step Б: calling LLM for analysis');
    result = await base44.integrations.Core.InvokeLLM({
      prompt: `Ты — процессуально-ориентированный аналитик. Внимательно проанализируй сессию ниже и извлеки память о пользователе.
ОБЯЗАТЕЛЬНО заполни хотя бы themes, progress и (если есть) insights — НЕ возвращай пустые массивы, если в диалоге есть хоть какое-то содержание. Опирайся на реальные слова и темы пользователя, не выдумывай.

КРИТИЧЕСКОЕ ПРАВИЛО ФОРМУЛИРОВОК (СТРОГО): НИКОГДА не используй слова «пользователь», «человек», «он», «она» как подлежащее. Каждое значение — короткая безличная фраза от третьего лица БЕЗ подлежащего, как заметка о человеке.
Например: «Избегает телесного контакта», «Чувствует тревогу при финансовых решениях», «Склонен к самокритике», «Замечает паттерн избегания», «Осознал, что...».
СТРОГО ЗАПРЕЩЕНО начинать фразу со слов «Пользователь», «Человек», «Он», «Она».

ВАЖНО ПРО ЯЗЫК: пиши значения на том же языке, на котором говорил человек в сессии (русский или испанский). Если сессия на испанском — то же правило: НИКОГДА не начинай с «El usuario», «La persona», «Él», «Ella».

Поля:
- insights: ключевые открытия/осознания пользователя
- patterns: повторяющиеся паттерны реакций или поведения
- themes: темы, которые поднимал пользователь (всегда заполняй, если есть содержание)
- body_signals: телесные сигналы, если упоминались
- edge: описание края/сопротивления ИЛИ краевой фигуры. Внутренний критик, внутренний запрещающий/контролирующий голос или часть, которая «не разрешает», «мешает», «останавливает», «критикует», — это значимый edge и должен быть сохранён здесь.
- primary_process: знакомые, идентично-согласованные способы/качества, если проявились
- secondary_process: новые, непривычные или возникающие качества/движения, если проявились
- resources: ресурсы, поддерживающие образы, фигуры, качества или действия, если проявились
- progress: одной фразой — в чём продвинулся пользователь (всегда заполняй, если была беседа)

Сессия:
${conversation}`,
      response_json_schema: {
        type: 'object',
        properties: {
          insights: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          themes: { type: 'array', items: { type: 'string' } },
          body_signals: { type: 'array', items: { type: 'string' } },
          edge: { type: 'string' },
          primary_process: { type: 'array', items: { type: 'string' } },
          secondary_process: { type: 'array', items: { type: 'string' } },
          resources: { type: 'array', items: { type: 'string' } },
          progress: { type: 'string' },
        },
      },
    });
  } catch (e) {
    console.error('[persistSessionMemory] LLM call FAILED (silent):', e?.message);
    return [];
  }

  if (!result || typeof result !== 'object') {
    console.warn('[persistSessionMemory] LLM returned an invalid response type');
    return [];
  }

  console.log('[persistSessionMemory] Step В: Claude JSON parsed', {
    insights: (result.insights || []).length,
    patterns: (result.patterns || []).length,
    themes: (result.themes || []).length,
    body_signals: (result.body_signals || []).length,
    edge: !!result.edge,
    primary_process: (result.primary_process || []).length,
    secondary_process: (result.secondary_process || []).length,
    resources: (result.resources || []).length,
    progress: !!result.progress,
  });

  const stripSubject = (s) =>
    String(s || '')
      .replace(/(^|;\s*)(пользовател[ьяюе]|человек|он|она)\s+/giu, (_m, sep) => sep)
      .replace(/(^|;\s*)(el usuario|la usuaria|la persona|él|ella|el)\s+/giu, (_m, sep) => sep)
      .replace(/(^|;\s*)([а-яёa-zñáéíóú])/gu, (_m, sep, ch) => sep + ch.toUpperCase());

  const join = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).map(stripSubject).join('; ') : '');
  const items = [];
  const insights = join(result.insights);
  const patterns = join(result.patterns);
  const themes = join(result.themes);
  const bodySignals = join(result.body_signals);
  const primaryProcess = join(result.primary_process);
  const secondaryProcess = join(result.secondary_process);
  const resources = join(result.resources);

  if (insights) items.push({ memory_type: 'insight', memory_key: 'insights', memory_value: insights });
  if (patterns) items.push({ memory_type: 'pattern', memory_key: 'patterns', memory_value: patterns });
  if (themes) items.push({ memory_type: 'theme', memory_key: 'themes', memory_value: themes });
  if (bodySignals) items.push({ memory_type: 'body_signal', memory_key: 'body_signals', memory_value: bodySignals });
  if (result.edge && result.edge !== 'null') items.push({ memory_type: 'edge', memory_key: 'edge', memory_value: stripSubject(result.edge) });
  if (primaryProcess) items.push({ memory_type: 'primary_process', memory_key: 'primary_process', memory_value: primaryProcess });
  if (secondaryProcess) items.push({ memory_type: 'secondary_process', memory_key: 'secondary_process', memory_value: secondaryProcess });
  if (resources) items.push({ memory_type: 'resource', memory_key: 'resources', memory_value: resources });
  if (result.progress) items.push({ memory_type: 'progress', memory_key: 'progress', memory_value: stripSubject(result.progress) });

  return items;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const sessionId = body.session_id || body.event?.entity_id;

    // Cross-session memory is optional. Existing users without the field keep
    // the previous default (enabled); an explicit false always wins.
    const caller = await base44.auth.me().catch(() => null);
    if (caller?.email) {
      const profiles = await base44.asServiceRole.entities.AppUser.filter({ email: caller.email }).catch(() => []);
      if (profiles[0]?.memory_enabled === false) {
        return Response.json({ skipped: true, reason: 'memory_disabled' });
      }
    }

    if (!sessionId) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    console.log('[persistSessionMemory] started');

    const sessions = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
    const session = sessions[0];
    if (!session) {
      console.warn('[persistSessionMemory] session not found');
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.memory_excluded === true) {
      console.log('[persistSessionMemory] session explicitly excluded from memory — skipping');
      return Response.json({ skipped: true, reason: 'session_excluded' });
    }

    if (session.status !== 'completed') {
      console.log('[persistSessionMemory] session not completed yet — skipping. status:', session.status);
      return Response.json({ skipped: true, reason: 'not_completed' });
    }

    const userId = session.user_id;
    if (!userId) {
      console.warn('[persistSessionMemory] session has no user_id — cannot attribute memory');
      return Response.json({ error: 'No owner on session' }, { status: 400 });
    }
    console.log('[persistSessionMemory] owner resolved', { mode: session.mode_id || session.mode });

    // Idempotency is per source session. Crucially, memories from a NEW session
    // must not overwrite an older session merely because both have memory_key="edge"
    // or memory_key="themes". Historical process material is longitudinal data.
    const already = await base44.asServiceRole.entities.UserMemory.filter({ source_session_id: sessionId });
    if (already.length > 0) {
      console.log('[persistSessionMemory] memory already exists for session — skipping');
      return Response.json({ skipped: true, reason: 'already_saved', count: already.length });
    }

    const messages = await base44.asServiceRole.entities.Message.filter({ session_id: sessionId }, 'created_at', 500);
    const userMessages = messages.filter((m) => m.role === 'user');
    console.log('[persistSessionMemory] Step А: messages', messages.length, 'user messages', userMessages.length);
    if (userMessages.length === 0) {
      console.log('[persistSessionMemory] no user messages — nothing to remember');
      return Response.json({ skipped: true, reason: 'no_user_messages' });
    }

    const items = await extractMemories(base44, messages);
    console.log('[persistSessionMemory] extracted item count:', items.length);
    if (items.length === 0) {
      console.log('[persistSessionMemory] no memory items extracted');
      return Response.json({ saved: 0 });
    }

    const now = new Date().toISOString();
    let savedCount = 0;

    // One row per (session, memory_key). Never destructively replace a memory
    // from another session. This is what previously made older themes such as
    // an internal critic disappear after later sessions were completed.
    for (const item of items) {
      if (!item.memory_value || !item.memory_key) continue;
      try {
        await base44.asServiceRole.entities.UserMemory.create({
          user_id: userId,
          memory_level: 'episodic',
          memory_type: item.memory_type || item.memory_key,
          memory_key: item.memory_key,
          memory_value: item.memory_value,
          source_session_id: sessionId,
          source_mode_id: session.mode_id || session.mode || null,
          importance: item.memory_key === 'edge' ? 'high' : 'medium',
          evidence_session_ids: [sessionId],
          evidence_count: 1,
          confidence: 0.65,
          first_seen_at: now,
          last_seen_at: now,
          user_status: 'unreviewed',
          excluded_from_ai: false,
          is_active: true,
          created_at: now,
          updated_at: now,
        });
        savedCount++;
        console.log('[persistSessionMemory] memory item created');
      } catch (writeErr) {
        console.error('[persistSessionMemory] memory write failed:', writeErr?.message);
      }
    }

    // Episodic memory is longitudinal history: do not deactivate old rows merely
    // because they are old. Prompt-size control happens at retrieval time.

    console.log('[persistSessionMemory] completed', { saved: savedCount });
    return Response.json({ saved: savedCount });
  } catch (error) {
    console.error('[persistSessionMemory] fatal (silent):', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});