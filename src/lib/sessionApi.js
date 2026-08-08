import { base44 } from "@/api/base44Client";
import { createMessage, listMessages } from "@/lib/messageApi";

/**
 * Starts a session through the backend, which enforces the free-trial quota.
 *
 * Continuation has a CLIENT-SIDE safety net on purpose. Base44 backend-function
 * deployments can lag behind the frontend/GitHub sync. If an older deployed
 * startSession function creates the new Session but does not reconstruct the
 * previous process state or seed the first continuation message, we repair that
 * here before navigating to SessionChat. This prevents a continued dream session
 * from falling through to the canonical "tell me a new dream" greeting.
 *
 * @returns {Promise<{session?: object, blocked?: boolean, reason?: string, modeId?: string}>}
 */

const EDGE_FIGURE_DIRECT_MARKERS = [
  "внутренний критик", "внутренняя критика", "внутренний цензор",
  "строгий внутренний голос", "контролирующая часть", "запрещающая часть",
  "осуждающая часть", "критикующая часть",
  "crítico interior", "crítica interior", "voz crítica interior",
  "parte controladora", "parte que prohíbe", "parte crítica",
];

const EDGE_FIGURE_GENERIC_MARKERS = [
  "внутренний голос", "голос внутри", "какая-то часть меня", "часть меня",
  "внутренняя часть", "голос в голове",
  "voz interior", "una parte de mí", "parte de mí", "voz en mi cabeza",
];

const EDGE_FUNCTION_MARKERS = [
  "запрещает", "не разрешает", "не позволяет", "останавливает", "мешает мне",
  "мешает", "удерживает", "не пускает", "говорит нельзя", "говорит, что нельзя",
  "говорит что нельзя", "нельзя", "стыдно", "опасно", "не имею права",
  "не заслуживаю", "критикует", "осуждает", "обесценивает", "требует", "контролирует",
  "me prohíbe", "no me deja", "no me permite", "me detiene", "me impide",
  "me frena", "dice que no", "no debo", "debería", "me critica", "me juzga",
  "me controla", "no lo merezco", "es peligroso", "me da vergüenza",
];

function arrayText(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("; ") : "";
}

function detectEdgeFigure(text) {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!lower) return null;

  const direct = EDGE_FIGURE_DIRECT_MARKERS.find((mk) => lower.includes(mk));
  if (direct) return raw.slice(0, 600);

  const hasGeneric = EDGE_FIGURE_GENERIC_MARKERS.some((mk) => lower.includes(mk));
  const hasBlockingFunction = EDGE_FUNCTION_MARKERS.some((mk) => lower.includes(mk));
  return hasGeneric && hasBlockingFunction ? raw.slice(0, 600) : null;
}

function buildContinuation(previous, legacyContext = "", modeId = "") {
  const summary = String(previous?.summary || "").trim();
  const nextStep = String(previous?.next_step_suggestion || "").trim();
  const primary = arrayText(previous?.primary_process);
  const secondary = arrayText(previous?.secondary_process);
  const edgeSignals = arrayText(previous?.edge_signals);

  const evidence = [summary, primary, secondary, edgeSignals, nextStep, legacyContext]
    .filter(Boolean)
    .join("\n");
  const edgeFigure = detectEdgeFigure(evidence);

  const contextParts = [
    "ПРОДОЛЖЕНИЕ ПРЕДЫДУЩЕЙ СЕССИИ. Уже пройденный материал нельзя просить повторить. Не запускай режим с нуля.",
  ];
  if (summary) contextParts.push(`Итог предыдущей сессии: ${summary.slice(0, 1400)}`);
  if (primary) contextParts.push(`Уже выявленный первичный процесс: ${primary.slice(0, 600)}`);
  if (secondary) contextParts.push(`Уже выявленный вторичный процесс: ${secondary.slice(0, 600)}`);
  if (edgeSignals) contextParts.push(`Ранее выявленные сигналы края: ${edgeSignals.slice(0, 600)}`);
  if (nextStep) contextParts.push(`Следующий незавершённый шаг: ${nextStep.slice(0, 1000)}`);
  if (!summary && !primary && !secondary && !edgeSignals && legacyContext) {
    contextParts.push(String(legacyContext).slice(0, 1400));
  }

  if (edgeFigure) {
    contextParts.push(
      `EDGE_FIGURE_DETECTED — ВНУТРЕННЯЯ ПРОФЕССИОНАЛЬНАЯ МЕТКА, НЕ ПРОИЗНОСИТЬ ПОЛЬЗОВАТЕЛЮ. ` +
      `В предыдущей работе уже появилась запрещающая/критикующая внутренняя фигура: «${edgeFigure.slice(0, 600)}». ` +
      "Считай это уже выявленным краем. Следующий процессуальный ход — работа с этой фигурой и её функцией: " +
      "что именно она говорит/запрещает/охраняет, чего не допускает и что происходит у перехода. " +
      "Не возвращайся к новому сну, первичному/вторичному картированию или выбору нового фокуса, если пользователь сам не меняет тему."
    );
  }

  const context = contextParts.join("\n\n");
  const anchor = edgeFigure || nextStep || summary || secondary || primary || legacyContext || "предыдущем процессе";
  const cleanAnchor = String(anchor).replace(/\s+/g, " ").slice(0, 520);

  let greeting;
  if (edgeFigure) {
    greeting =
      `В прошлый раз мы остановились здесь: «${cleanAnchor}». ` +
      "Продолжим именно с этого внутреннего голоса или части, не начиная всё заново. " +
      "Что этот голос сейчас говорит или запрещает тебе, когда ты приближаешься к тому, что хочешь себе разрешить?";
  } else {
    const modeNote = String(modeId).includes("dream")
      ? "Новый сон рассказывать не нужно, если ты сама не хочешь сменить тему. "
      : "Начинать тему заново не нужно. ";
    greeting =
      `В прошлый раз мы остановились здесь: «${cleanAnchor}». ` +
      modeNote +
      "Что в этом месте сейчас осталось самым живым или незавершённым?";
  }

  return { context, greeting, edgeFigure };
}

async function repairContinuationIfNeeded(session, modeId, opts) {
  if (!session?.id || !opts?.continuedFromSessionId) return session;

  try {
    const previousRows = await base44.entities.Session.filter({ id: String(opts.continuedFromSessionId) });
    const previous = previousRows?.[0] || null;
    if (!previous) return session;

    const { context, greeting, edgeFigure } = buildContinuation(previous, opts.carryOverContext || "", modeId);

    // Keep the rich continuation available on EVERY later AI turn.
    // This also upgrades sessions created by an older deployed backend function.
    if (context && session.carry_over_context !== context) {
      await base44.entities.Session.update(session.id, {
        continued_from_session_id: String(opts.continuedFromSessionId),
        carry_over_context: context,
      }).catch((e) => console.warn("[CONTINUATION_REPAIR] session context update failed", e?.message));
      session = { ...session, continued_from_session_id: String(opts.continuedFromSessionId), carry_over_context: context };
    }

    // New backend code already seeds this message. Old backend code does not.
    // Seed it only when the session is still empty, so there can never be a duplicate.
    const existingMessages = await listMessages(session.id).catch(() => []);
    if (!existingMessages.length) {
      await createMessage({
        session_id: session.id,
        mode_id: modeId,
        step_number: session.current_step || 1,
        role: "assistant",
        content: greeting,
      });
      console.log("[CONTINUATION_REPAIR] greeting seeded client-side", {
        sessionId: session.id,
        edgeFigureDetected: !!edgeFigure,
      });
    }
  } catch (e) {
    console.error("[CONTINUATION_REPAIR] failed — continuing with server session", e?.message || e);
  }

  return session;
}

export async function startSession(modeId, opts = {}) {
  const payload = { modeId };
  if (opts.continuedFromSessionId) payload.continuedFromSessionId = opts.continuedFromSessionId;
  if (opts.carryOverContext) payload.carryOverContext = opts.carryOverContext;

  const res = await base44.functions.invoke("startSession", payload);
  const data = res?.data ?? res;

  if (data?.blocked) {
    return { blocked: true, reason: data.reason, modeId: data.modeId };
  }
  if (!data?.session) {
    throw new Error(data?.error || "Could not start the session");
  }

  const session = await repairContinuationIfNeeded(data.session, modeId, opts);
  return { session };
}
