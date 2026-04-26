import { base44 } from "@/api/base44Client";

// ─── Crisis detection ────────────────────────────────────────────────────────
const CRISIS_KEYWORDS = [
  "суицид", "убить себя", "покончить", "самоубийство",
  "самоповреждение", "порезать себя", "резать вены",
  "не хочу жить", "нет смысла жить", "лучше бы меня не было",
  "хочу умереть", "убить", "насилие",
];

export const CRISIS_MESSAGE = `⚠️ Я заметил(а), что вы упомянули что-то важное.

Этот инструмент — для самоисследования, и он не заменяет профессиональную помощь.

Если вам сейчас тяжело, пожалуйста, обратитесь:

📞 Телефон доверия: 8-800-2000-122 (бесплатно, 24/7)
📞 Центр экстренной психологической помощи МЧС: 8-499-216-50-50
📱 Линия психологической помощи: 051 (с мобильного)

Вы не одиноки. Помощь доступна.`;

export function checkCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Fetch step from DB ──────────────────────────────────────────────────────
export async function fetchStep(modeId, stepNumber) {
  const stepKey = `${modeId}_${stepNumber}`;
  const rows = await base44.entities.ModeStep.filter({ step_key: stepKey });
  return rows[0] || null;
}

// ─── Fetch related terms from DB ─────────────────────────────────────────────
async function fetchRelatedTerms(relatedTermIds) {
  if (!relatedTermIds) return [];
  const ids = relatedTermIds.split(";").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];
  // Fetch each term individually and collect
  const results = await Promise.all(
    ids.map((tid) => base44.entities.Term.filter({ term_id: tid }))
  );
  return results.flat();
}

// ─── Main AI response ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — опытный фасилитатор Процесс-ориентированной психологии (Process Work, Арнольд Минделл). Ты ведёшь человека в пространство внутреннего исследования — тепло, внимательно, без спешки.

СТИЛЬ:
- Говоришь живым, естественным русским языком — как умный, чуткий человек, а не как анкета.
- Никогда не повторяешь слова пользователя механически и дословно.
- Не перечисляешь варианты (давление / жар / пульсация), если это не оправдано контекстом.
- Даёшь короткое, точное отражение — 1 предложение максимум, если оно вообще нужно.
- Задаёшь ровно один вопрос. Осмысленный, следующий по глубине.
- Ответ — 1–3 предложения суммарно. Никогда длиннее.

ЗАПРЕЩЕНО:
- Ставить диагнозы, интерпретировать жёстко, давать советы
- Начинать со слов «Я понимаю», «Конечно», «Это важно» — это звучит шаблонно
- Завершать ответ без вопроса (кроме случая завершения сессии)
- Повторять уже заданные вопросы

ЛОГИКА ГЛУБИНЫ (в режиме ТЕЛО):
Телесное ощущение → качество / характер → движение или импульс → образ / существо → послание → связь с жизнью
Если пользователь уже назвал качество — не спрашивай о нём снова. Двигайся дальше.

ТОНАЛЬНОСТЬ:
Тёплая, профессиональная, немного поэтичная. Как будто рядом сидит мудрый и внимательный человек.`;

export async function getAIResponse(session, step, messages, userMessage) {
  // Last 8 messages for context
  const recent = messages.slice(-8);
  const history = recent
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  // Related terms
  const terms = await fetchRelatedTerms(step?.related_term_ids);
  const termsContext = terms.length
    ? "\n\nРелевантные концепции Process Work:\n" +
      terms
        .map((t) => `• ${t.term}: ${t.short_definition || ""}${t.practical_application ? " | Применение: " + t.practical_application : ""}`)
        .join("\n")
    : "";

  const stepContext = step
    ? `\n\nТекущий шаг: ${step.step_number}
Цель шага: ${step.goal || "—"}
Направляющий вопрос: "${step.question || "—"}"
Подсказка фасилитатору: ${step.facilitator_hint || "—"}`
    : "\n\nВсе шаги пройдены. Мягко завершай сессию.";

  const modeShiftHint = step?.possible_mode_shift
    ? `\n\nВозможный переход: ${step.possible_mode_shift}. Если это уместно — предложи пользователю: включи в конец ответа фразу «[SHIFT_SUGGEST:${step.pending_mode || ""}]» чтобы система показала кнопки выбора. Делай это только если смена режима явно уместна.`
    : "";

  const prompt = `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}

Режим: ${session.mode_id || session.mode}

История разговора:
${history}

Пользователь: ${userMessage}

Ответь. Максимум 1–3 предложения. Только один вопрос в конце. Никакого повтора слов пользователя дословно. Живой русский язык.`;

  const response = await base44.integrations.Core.InvokeLLM({ prompt });
  return response;
}

// ─── Session summary ─────────────────────────────────────────────────────────
const FALLBACK_SUMMARY = {
  summary: "Сессия завершена. Резюме недоступно.",
  themes: [],
  signals: [],
  next_step_suggestion: "",
  memories: [],
};

export async function generateSessionSummary(session, messages) {
  // Only use last 12 messages to keep prompt short and fast
  const recent = messages.slice(-12);
  const conversation = recent
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "П" : "А"}: ${m.content}`)
    .join("\n");

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 15000)
  );

  const llmPromise = base44.integrations.Core.InvokeLLM({
    prompt: `Кратко проанализируй сессию Process Work. Режим: ${session.mode_id || session.mode}.

${conversation}

Ответь на русском.`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        themes: { type: "array", items: { type: "string" } },
        signals: { type: "array", items: { type: "string" } },
        next_step_suggestion: { type: "string" },
        memories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
              category: { type: "string", enum: ["emotion", "body", "dream", "conflict", "pattern", "insight"] },
              importance: { type: "string", enum: ["low", "medium", "high"] },
            },
          },
        },
      },
    },
  });

  try {
    const result = await Promise.race([llmPromise, timeoutPromise]);
    return result || FALLBACK_SUMMARY;
  } catch (e) {
    console.error("Summary generation failed:", e.message);
    return FALLBACK_SUMMARY;
  }
}