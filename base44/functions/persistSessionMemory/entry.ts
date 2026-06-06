import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MEMORY_LIMIT = 20;

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

ВАЖНОЕ ПРАВИЛО ФОРМУЛИРОВОК: пиши каждое значение БЕЗ слова «пользователь» — короткими фразами от третьего лица без подлежащего, как заметки о человеке.
Например: «Избегает телесного контакта», «Чувствует тревогу при финансовых решениях», «Склонен к самокритике», «Замечает паттерн избегания», «Осознал, что...».
НЕ пиши «Пользователь испытывает...», «Пользователь осознал...».

Поля:
- insights: ключевые открытия/осознания пользователя
- patterns: повторяющиеся паттерны реакций или поведения
- themes: темы, которые поднимал пользователь (всегда заполняй, если есть содержание)
- body_signals: телесные сигналы, если упоминались
- edge: описание края/сопротивления, если был, иначе пустая строка
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
          progress: { type: 'string' },
        },
      },
    });
  } catch (e) {
    console.error('[persistSessionMemory] LLM call FAILED (silent):', e?.message);
    return [];
  }

  if (!result || typeof result !== 'object') {
    console.warn('[persistSessionMemory] Claude returned non-object (silent):', result);
    return [];
  }

  console.log('[persistSessionMemory] Step В: Claude JSON parsed', {
    insights: (result.insights || []).length,
    patterns: (result.patterns || []).length,
    themes: (result.themes || []).length,
    body_signals: (result.body_signals || []).length,
    edge: !!result.edge,
    progress: !!result.progress,
  });

  const join = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join('; ') : '');
  const items = [];
  const insights = join(result.insights);
  const patterns = join(result.patterns);
  const themes = join(result.themes);
  const bodySignals = join(result.body_signals);

  if (insights) items.push({ memory_type: 'insight', memory_key: 'insights', memory_value: insights });
  if (patterns) items.push({ memory_type: 'pattern', memory_key: 'patterns', memory_value: patterns });
  if (themes) items.push({ memory_type: 'theme', memory_key: 'themes', memory_value: themes });
  if (bodySignals) items.push({ memory_type: 'body_signal', memory_key: 'body_signals', memory_value: bodySignals });
  if (result.edge && result.edge !== 'null') items.push({ memory_type: 'edge', memory_key: 'edge', memory_value: result.edge });
  if (result.progress) items.push({ memory_type: 'progress', memory_key: 'progress', memory_value: result.progress });

  return items;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    // Accept session_id directly OR an entity-automation payload { event: { entity_id } }
    const sessionId = body.session_id || body.event?.entity_id;

    if (!sessionId) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    console.log('[persistSessionMemory] START session:', sessionId);

    // ── Load session (service role — works for automations and any user) ──────
    const sessions = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
    const session = sessions[0];
    if (!session) {
      console.warn('[persistSessionMemory] session not found:', sessionId);
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'completed') {
      console.log('[persistSessionMemory] session not completed yet — skipping. status:', session.status);
      return Response.json({ skipped: true, reason: 'not_completed' });
    }

    // user_id = the User who owns this session (consistent with UserMemory RLS data.user_id == user.id)
    const userId = session.created_by_id;
    if (!userId) {
      console.warn('[persistSessionMemory] session has no created_by_id — cannot attribute memory');
      return Response.json({ error: 'No owner on session' }, { status: 400 });
    }
    console.log('[persistSessionMemory] owner user_id:', userId, 'mode:', session.mode_id || session.mode);

    // ── Idempotency: skip if memory already saved for this session ────────────
    const already = await base44.asServiceRole.entities.UserMemory.filter({ source_session_id: sessionId });
    if (already.length > 0) {
      console.log('[persistSessionMemory] memory already exists for session — skipping');
      return Response.json({ skipped: true, reason: 'already_saved', count: already.length });
    }

    // ── Step А: collect all messages of this session ──────────────────────────
    const messages = await base44.asServiceRole.entities.Message.filter({ session_id: sessionId }, 'created_at', 500);
    const userMessages = messages.filter((m) => m.role === 'user');
    console.log('[persistSessionMemory] Step А: messages', messages.length, 'user messages', userMessages.length);
    if (userMessages.length === 0) {
      console.log('[persistSessionMemory] no user messages — nothing to remember');
      return Response.json({ skipped: true, reason: 'no_user_messages' });
    }

    // ── Steps Б+В: analyze ────────────────────────────────────────────────────
    const items = await extractMemories(base44, messages);
    console.log('[persistSessionMemory] extracted items:', items.length, items.map((i) => i.memory_key));
    if (items.length === 0) {
      console.log('[persistSessionMemory] no memory items extracted');
      return Response.json({ saved: 0 });
    }

    // ── Existing memories for dedupe by memory_key ────────────────────────────
    const existing = await base44.asServiceRole.entities.UserMemory.filter({ user_id: userId });
    const byKey = {};
    for (const row of existing) {
      const prev = byKey[row.memory_key];
      if (!prev || new Date(row.updated_at || row.created_date) > new Date(prev.updated_at || prev.created_date)) {
        byKey[row.memory_key] = row;
      }
    }

    const now = new Date().toISOString();
    let savedCount = 0;

    // ── Steps Г+Д: create or update ───────────────────────────────────────────
    for (const item of items) {
      if (!item.memory_value || !item.memory_key) continue;
      const target = byKey[item.memory_key];
      try {
        if (target) {
          await base44.asServiceRole.entities.UserMemory.update(target.id, {
            memory_value: item.memory_value,
            memory_type: item.memory_type || target.memory_type,
            source_session_id: sessionId,
            source_mode_id: session.mode_id || session.mode || null,
            importance: 'medium',
            is_active: true,
            updated_at: now,
          });
          console.log('[persistSessionMemory] updated memory_key:', item.memory_key);
        } else {
          await base44.asServiceRole.entities.UserMemory.create({
            user_id: userId,
            memory_type: item.memory_type || item.memory_key,
            memory_key: item.memory_key,
            memory_value: item.memory_value,
            source_session_id: sessionId,
            source_mode_id: session.mode_id || session.mode || null,
            importance: 'medium',
            is_active: true,
            created_at: now,
            updated_at: now,
          });
          console.log('[persistSessionMemory] created memory_key:', item.memory_key);
        }
        savedCount++;
      } catch (writeErr) {
        console.error('[persistSessionMemory] write failed for', item.memory_key, '—', writeErr?.message);
      }
    }

    // ── Enforce limit: deactivate oldest active beyond MEMORY_LIMIT ────────────
    const active = await base44.asServiceRole.entities.UserMemory.filter(
      { user_id: userId, is_active: true },
      '-updated_at',
      200
    );
    if (active.length > MEMORY_LIMIT) {
      for (const row of active.slice(MEMORY_LIMIT)) {
        await base44.asServiceRole.entities.UserMemory.update(row.id, { is_active: false }).catch(() => {});
      }
    }

    console.log('[persistSessionMemory] DONE — saved/updated:', savedCount, 'for session:', sessionId);
    return Response.json({ saved: savedCount, session_id: sessionId, user_id: userId });
  } catch (error) {
    // Never surface errors to the user-facing flow.
    console.error('[persistSessionMemory] fatal (silent):', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});