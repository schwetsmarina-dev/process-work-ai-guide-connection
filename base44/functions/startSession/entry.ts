import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Creates a session, enforcing the free-trial quota server-side.
 *
 * Continuations are reconstructed SERVER-SIDE from the previous Session record.
 * This is intentional: the browser must not be the source of truth for prior
 * process state, and a continuation must never silently degrade into a brand-new
 * mode opening (e.g. asking for a new dream after the person chose to continue).
 *
 * Body: {
 *   modeId: "body" | "dream" | "conflict" | "journaling",
 *   continuedFromSessionId?: string,
 *   carryOverContext?: string // legacy/fallback only
 * }
 */

const FREE_SESSIONS_PER_MODE = 1;

const EDGE_FIGURE_DIRECT_MARKERS = [
  // RU
  'внутренний критик', 'внутренняя критика', 'внутренний цензор',
  'строгий внутренний голос', 'контролирующая часть', 'запрещающая часть',
  'осуждающая часть', 'критикующая часть',
  // ES
  'crítico interior', 'crítica interior', 'voz crítica interior',
  'parte controladora', 'parte que prohíbe', 'parte crítica',
];

const EDGE_FIGURE_GENERIC_MARKERS = [
  // RU
  'внутренний голос', 'голос внутри', 'какая-то часть меня', 'часть меня',
  'внутренняя часть', 'голос в голове',
  // ES
  'voz interior', 'una parte de mí', 'parte de mí', 'voz en mi cabeza',
];

const EDGE_FUNCTION_MARKERS = [
  // RU
  'запрещает', 'не разрешает', 'не позволяет', 'останавливает', 'мешает мне',
  'мешает', 'удерживает', 'не пускает', 'говорит нельзя', 'говорит, что нельзя',
  'говорит что нельзя', 'нельзя', 'стыдно', 'опасно', 'не имею права',
  'не заслуживаю', 'критикует', 'осуждает', 'обесценивает', 'требует', 'контролирует',
  // ES
  'me prohíbe', 'no me deja', 'no me permite', 'me detiene', 'me impide',
  'me frena', 'dice que no', 'no debo', 'debería', 'me critica', 'me juzga',
  'me controla', 'no lo merezco', 'es peligroso', 'me da vergüenza',
];

function extractSentenceAround(text, marker) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const idx = lower.indexOf(marker);
  if (idx === -1) return null;
  const sentences = raw.split(/(?<=[.!?\n])\s+/);
  let cursor = 0;
  for (const sentence of sentences) {
    const end = cursor + sentence.length;
    if (idx >= cursor && idx <= end + 1) return sentence.trim();
    cursor = end + 1;
  }
  return raw.slice(Math.max(0, idx - 60), idx + 180).trim();
}

function detectEdgeFigure(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  if (!lower) return null;

  const direct = EDGE_FIGURE_DIRECT_MARKERS.find((mk) => lower.includes(mk));
  if (direct) return extractSentenceAround(raw, direct) || raw.slice(0, 300);

  const generic = EDGE_FIGURE_GENERIC_MARKERS.find((mk) => lower.includes(mk));
  const blocking = EDGE_FUNCTION_MARKERS.some((mk) => lower.includes(mk));
  if (generic && blocking) return extractSentenceAround(raw, generic) || raw.slice(0, 300);

  return null;
}

function arrayText(value) {
  return Array.isArray(value) ? value.filter(Boolean).join('; ') : '';
}

function buildContinuationContext(previous, legacyContext = '') {
  const summary = String(previous?.summary || '').trim();
  const nextStep = String(previous?.next_step_suggestion || '').trim();
  const primary = arrayText(previous?.primary_process);
  const secondary = arrayText(previous?.secondary_process);
  const storedEdges = arrayText(previous?.edge_signals);

  const processEvidence = [summary, nextStep, primary, secondary, storedEdges]
    .filter(Boolean)
    .join('\n');
  const edgeFigure = detectEdgeFigure(processEvidence);

  const blocks = [
    'ПРОДОЛЖЕНИЕ ПРЕДЫДУЩЕЙ СЕССИИ. Это уже пройденный материал; не проси пользователя повторять его и не запускай режим с нуля.',
  ];

  if (summary) blocks.push(`Итог предыдущей сессии: ${summary.slice(0, 1200)}`);
  if (primary) blocks.push(`Уже выявленный первичный процесс: ${primary.slice(0, 500)}`);
  if (secondary) blocks.push(`Уже выявленный вторичный процесс: ${secondary.slice(0, 500)}`);
  if (storedEdges) blocks.push(`Ранее отмеченные сигналы края/сопротивления (внутренняя профессиональная метка): ${storedEdges.slice(0, 500)}`);
  if (nextStep) blocks.push(`Следующий незавершённый шаг: ${nextStep.slice(0, 900)}`);

  if (edgeFigure) {
    blocks.push(
      `EDGE_FIGURE_DETECTED (внутренняя метка, НЕ произносить пользователю): «${edgeFigure.slice(0, 500)}». ` +
      'Это уже выявленная краевая фигура/функция, а не новая тема. Продолжай протокол работы с краевой фигурой: ' +
      'исследуй её голос/роль/запрет, что именно она охраняет или не допускает, и что происходит у перехода. ' +
      'Не возвращайся к рассказу сна, картированию с нуля, первичному/вторичному вопросу или выбору нового фокуса, ' +
      'если пользователь сам явно не меняет тему.'
    );
  }

  if (!summary && !nextStep && !primary && !secondary && legacyContext) {
    blocks.push(`Legacy context: ${String(legacyContext).slice(0, 1200)}`);
  }

  return { context: blocks.join('\n\n'), edgeFigure, summary, nextStep };
}

function buildContinuationGreeting({ modeId, previous, edgeFigure, summary, nextStep }) {
  const previousPoint = (edgeFigure || nextStep || summary || 'предыдущем процессе').trim();
  const cleanPoint = previousPoint.replace(/\s+/g, ' ').slice(0, 520);

  if (edgeFigure) {
    return (
      `В прошлый раз мы остановились вот здесь: «${cleanPoint}». ` +
      'Не будем начинать всё заново — продолжим именно с этого внутреннего голоса или части. ' +
      'Что он сейчас говорит или делает, когда ты приближаешься к тому, что он тебе не разрешает?'
    );
  }

  const modeNote = modeId === 'dream'
    ? 'Новый сон рассказывать не нужно, если ты сама не хочешь сменить тему.'
    : 'Начинать тему заново не нужно.';

  return (
    `В прошлый раз мы остановились вот здесь: «${cleanPoint}». ${modeNote} ` +
    'Продолжим отсюда: что сейчас в этом месте кажется самым живым или незавершённым?'
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const modeId = String(body?.modeId || '').trim();
    if (!modeId) {
      return Response.json({ error: 'modeId is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const email = String(user.email || '').toLowerCase();
    const now = new Date();

    // ── Entitlement ──────────────────────────────────────────────────────────
    const rows = (await svc.entities.Entitlement.filter({ user_email: email })) || [];
    const hasFullAccess = rows.some(
      (e) =>
        e.status === 'active' &&
        (e.plan === 'beta' || e.plan === 'paid') &&
        (!e.expires_at || new Date(e.expires_at) > now),
    );

    // ── Quota, for free users only ───────────────────────────────────────────
    if (!hasFullAccess) {
      const sessions = (await svc.entities.Session.filter({ user_id: user.id })) || [];
      const usedInMode = sessions.filter((s) => (s.mode_id || s.mode) === modeId).length;

      if (usedInMode >= FREE_SESSIONS_PER_MODE) {
        console.log('[startSession] blocked by quota', { email, modeId, usedInMode });
        return Response.json({
          blocked: true,
          reason: 'quota',
          modeId,
          usedInMode,
          limit: FREE_SESSIONS_PER_MODE,
        });
      }
    }

    // ── Resolve continuation from trusted previous Session ───────────────────
    let previous = null;
    let continuation = null;
    if (body?.continuedFromSessionId) {
      const previousRows = await svc.entities.Session.filter({ id: String(body.continuedFromSessionId) });
      previous = previousRows?.[0] || null;

      if (!previous) {
        return Response.json({ error: 'Previous session not found' }, { status: 404 });
      }
      if (previous.user_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Previous session does not belong to current user' }, { status: 403 });
      }

      continuation = buildContinuationContext(previous, body?.carryOverContext || '');
    }

    // ── Create ───────────────────────────────────────────────────────────────
    const extras = {};
    if (body?.continuedFromSessionId) {
      extras.continued_from_session_id = String(body.continuedFromSessionId);
    }
    if (continuation?.context) {
      extras.carry_over_context = continuation.context;
    } else if (body?.carryOverContext) {
      extras.carry_over_context = String(body.carryOverContext);
    }

    const session = await svc.entities.Session.create({
      ...extras,
      mode_id: modeId,
      mode: modeId,
      status: 'active',
      current_step: 1,
      created_by_id: user.id,
      created_by: user.email,
      user_id: user.id,
      started_at: new Date().toISOString(),
    });

    // A continuation gets its first assistant message here, before the client
    // opens SessionChat. SessionChat sees an existing message and therefore does
    // NOT generate the canonical "start from scratch" greeting for the mode.
    if (previous && continuation?.context && session?.id) {
      const greeting = buildContinuationGreeting({
        modeId,
        previous,
        edgeFigure: continuation.edgeFigure,
        summary: continuation.summary,
        nextStep: continuation.nextStep,
      });

      await svc.entities.Message.create({
        session_id: session.id,
        mode_id: modeId,
        step_number: 1,
        role: 'assistant',
        content: greeting,
        created_at: new Date().toISOString(),
      });

      console.log('[startSession] continuation restored', {
        sessionId: session.id,
        previousSessionId: previous.id,
        edgeFigureDetected: !!continuation.edgeFigure,
        hasSummary: !!continuation.summary,
        hasNextStep: !!continuation.nextStep,
      });
    }

    console.log('[startSession] created', {
      email,
      modeId,
      sessionId: session?.id,
      fullAccess: hasFullAccess,
      continued: !!previous,
    });

    return Response.json({ session });
  } catch (error) {
    console.error('[startSession] error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
