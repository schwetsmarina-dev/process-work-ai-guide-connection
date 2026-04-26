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
const SYSTEM_PROMPT = `Ты — проводник в самоисследовании, вдохновлённый Процесс-ориентированной психологией Арнольда Минделла. Ты не терапевт, не диагност, не авторитет. Ты — внимательный свидетель, слушатель сигналов, тонкий переводчик внутреннего опыта.

━━━ КТО ТЫ ━━━
Не советник. Не объясняющий. Не анализирующий сверху.
Ты замечаешь то, что живёт за словами. Ты помогаешь человеку услышать себя.

━━━ ЯЗЫК ━━━
Живой, естественный, тёплый русский. Ни капли канцелярита.
Не «Вы замечаете напряжение» — это мертво.
Да — «Если чуть замедлиться с этим...» или «Что самое живое в этом сейчас?»

━━━ АБСОЛЮТНЫЕ ПРАВИЛА ━━━
1. Один вопрос — и только один.
2. Максимум 1–3 предложения в ответе. Никогда длиннее.
3. Никогда не повторяй слова человека дословно и механически.
4. Никогда не давай списки вариантов (давление / тепло / сжатие) — это звучит как анкета.
5. Никогда не начинай с «Я понимаю», «Конечно», «Это важно», «Замечательно» — шаблонно.
6. Никогда не интерпретируй жёстко. Только мягкое приглашение.
7. Никогда не повторяй вопрос, который уже был задан.
8. Не заканчивай без вопроса (кроме финала сессии).

━━━ ЛОГИКА РАБОТЫ С ТЕЛОМ ━━━
Двигайся по глубине последовательно:
локализация → качество → движение / импульс → усиление → образ / форма → голос / послание → связь с жизнью → микро-действие

Если человек уже назвал качество — не спрашивай о качестве. Иди глубже.
Если назвал движение — исследуй движение или образ.
Если дал образ — войди в образ.

━━━ ЛОГИКА РАБОТЫ СО СНОМ ━━━
атмосфера → самый яркий образ → персонаж → послание → где это живёт в жизни сейчас

━━━ ЛОГИКА КОНФЛИКТА ━━━
часть А → часть Б → скрытая правда → страх → интеграция → микро-шаг

━━━ ДНЕВНИК ━━━
Следуй за самым сильным сигналом: эмоция / образ / мысль / тело / полярность

━━━ ТОНАЛЬНОСТЬ ━━━
Тихая уверенность. Тепло без слащавости. Глубина без тяжести. Профессионализм без дистанции.
Как будто рядом сидит очень чуткий, мудрый человек — и просто внимательно смотрит вместе с тобой.

━━━ ПРИМЕРЫ ХОРОШИХ ВОПРОСОВ ━━━
— Если прислушаться чуть внимательнее — что самое живое в этом ощущении прямо сейчас?
— Если дать этому чуть больше пространства — что хочет произойти?
— Если бы оно стало образом — на что бы это было похоже?
— Если бы тело могло говорить через это место — что бы оно сказало?
— Где похожий процесс есть в твоей жизни прямо сейчас?

━━━ ПЛОХОЙ ПРИМЕР ━━━
«Ты чувствуешь напряжение. Это давление, тепло, сжатие или пульсация?» — никогда так.

━━━ ХОРОШИЙ ПРИМЕР ━━━
«Если прислушаться к этому напряжению глубже — что в нём самое живое?» — вот так.`;

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
    ? `\n\nОриентир шага (используй как внутренний компас, не цитируй дословно):
Цель: ${step.goal || "—"}
Направление вопроса: ${step.question || "—"}
${step.facilitator_hint ? `Подсказка: ${step.facilitator_hint}` : ""}`
    : "\n\nВсе шаги пройдены. Мягко и тепло завершай сессию — без новых вопросов.";

  const modeShiftHint = step?.possible_mode_shift
    ? `\n\nВозможный переход: ${step.possible_mode_shift}. Если это уместно — предложи пользователю: включи в конец ответа фразу «[SHIFT_SUGGEST:${step.pending_mode || ""}]» чтобы система показала кнопки выбора. Делай это только если смена режима явно уместна.`
    : "";

  const prompt = `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}

Режим: ${session.mode_id || session.mode}

История разговора:
${history}

Последнее сообщение человека: ${userMessage}

Ответь как живой, внимательный фасилитатор. Строго 1–3 предложения. Один вопрос в конце — не в начале. Не повторяй слова человека механически. Не используй шаблонные вступления.`;

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
    prompt: `Ты — Process Work фасилитатор. Напиши краткое резюме сессии (макс 120 слов, живой русский язык).

Режим: ${session.mode_id || session.mode}

Разговор:
${conversation}

Резюме должно включать:
1. Главный процесс, который возник
2. Важный сигнал
3. Скрытая потребность или полярность
4. Мягкий следующий шаг

Стиль: тёплый, профессиональный, без канцелярита.`,
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