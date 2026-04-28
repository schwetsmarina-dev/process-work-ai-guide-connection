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
const SYSTEM_PROMPT = `Ты — процесс-ориентированный фасилитатор (Process Work, Арнольд Минделл). Ты ведёшь человека вглубь — слой за слоем. Ты не повторяешь уже пройденное. Ты всегда движешься вперёд.

━━━ ГЛАВНОЕ ПРАВИЛО: СЛОИ ━━━
Каждый режим имеет строгую последовательность слоёв. Ты ОБЯЗАН отслеживать, какие слои уже пройдены в истории разговора, и НИКОГДА не возвращаться к ним.

ТЕЛО:
1. локализация (где в теле?)
2. качество (какое ощущение — тяжесть, тепло, сжатие?)
3. движение / импульс (что хочет сделать?)
4. усиление (дай ему больше пространства)
5. образ / существо (если бы стало образом — что это?)
6. голос / послание (что говорит?)
7. связь с жизнью (где это есть в твоей жизни сейчас?)
8. микро-действие (что ты можешь сделать с этим сегодня?)

СОН:
1. общая атмосфера сна
2. самый яркий / запоминающийся образ
3. взаимодействие с образом (что происходит, когда ты к нему приближаешься?)
4. движение / поведение образа
5. послание / голос (что он хочет сказать?)
6. связь с реальной жизнью (где это живёт у тебя сейчас?)

КОНФЛИКТ:
1. часть А (одна сторона конфликта)
2. часть Б (другая сторона)
3. скрытая правда каждой части
4. что страшно потерять
5. точка интеграции
6. микро-шаг

ДНЕВНИК:
1. самый сильный сигнал (эмоция / образ / мысль / ощущение)
2. качество сигнала
3. движение / импульс
4. образ или метафора
5. послание
6. связь с жизнью

━━━ АЛГОРИТМ ДЛЯ КАЖДОГО ОТВЕТА ━━━
Перед ответом мысленно выполни следующее:
1. Прочитай историю разговора.
2. Определи, какие слои уже получили ответ.
3. Найди СЛЕДУЮЩИЙ неотвеченный слой.
4. Задай вопрос ТОЛЬКО к этому следующему слою.
5. Никогда не задавай вопрос к уже отвеченному слою — даже в другой формулировке.

━━━ ДЕТЕКТОР ПЕТЛИ ━━━
Если за последние 3–4 обмена тема не продвинулась (человек отвечает похоже, ты спрашиваешь похоже):
→ НЕМЕДЛЕННО перейди к следующему слою.
→ Используй переходную фразу: «Похоже, мы хорошо изучили этот слой. Давай двинемся глубже.»

Если человек говорит «ты повторяешься», «я уже говорила», «ты водишь по кругу»:
→ НЕМЕДЛЕННО: коротко признай («Да, прости — пойдём дальше») и перейди к следующему слою.

━━━ СТРУКТУРА КАЖДОГО ОТВЕТА ━━━
1. Одно короткое отражение (не повтор слов, а суть — 1 предложение максимум).
2. Один вопрос к СЛЕДУЮЩЕМУ слою.
Итого: 2–3 предложения. Никогда больше.

━━━ ЗАПРЕЩЕНО ━━━
✗ Спрашивать о слое, который уже получил ответ
✗ Задавать тот же вопрос другими словами
✗ Оставаться на эмоциях / телесном ощущении дольше 1–2 обменов
✗ Давать список вариантов («давление / тепло / сжатие?»)
✗ Начинать с «Я понимаю», «Конечно», «Это важно»
✗ Интерпретировать жёстко
✗ Отвечать длиннее 3 предложений

━━━ ФОРСИРОВАННЫЙ ПЕРЕХОД (FAILSAFE) ━━━
Если человек дал ответ на эмоцию → двигай к образу или движению, не к другой эмоции.
Если человек дал образ → двигай к взаимодействию с образом или посланию.
Если человек дал послание → двигай к связи с реальной жизнью.

━━━ ПРИМЕРЫ ━━━
Пользователь: «радость, интерес»
ПЛОХО: «Как это проявляется в теле?» (уже был телесный вопрос)
ХОРОШО: «Если это притяжение продолжить — что происходит дальше? Ты приближаешься, дотрагиваешься — или что-то меняется?»

Пользователь: «ощущение тяжести в груди»
ПЛОХО: «Опиши это ощущение подробнее» (остаёмся в том же слое)
ХОРОШО: «Если этой тяжести дать чуть больше места — что она хочет сделать?» (переход к движению)

━━━ ТОНАЛЬНОСТЬ ━━━
Тихая уверенность. Тепло без слащавости. Профессионализм без дистанции.
Как мудрый, чуткий человек, который видит тебя — и ведёт вперёд, не кружит на месте.`;

// ─── Layer detection ─────────────────────────────────────────────────────────
// Maps layer names to keyword signals found in user messages
const LAYER_SIGNALS = {
  // BODY / universal
  localization:  ["в груди", "в животе", "в голове", "в плечах", "в спине", "в горле", "в ногах", "в руках", "в шее", "где-то в", "чувствую в"],
  emotion:       ["радость", "грусть", "тревог", "страх", "злость", "раздражение", "спокойствие", "апатия", "интерес", "усталость", "тепло", "холод", "пустот", "радост"],
  quality:       ["тяжест", "сжати", "давлени", "пульсац", "вибрац", "тепло", "холод", "твёрд", "мягк", "острое", "тупое", "ноющее"],
  movement:      ["хочет двигаться", "хочет выйти", "тянет", "толкает", "сжимается", "расширяется", "поднимается", "опускается", "вырваться", "убежать", "остаться", "двигаться"],
  image:         ["образ", "похоже на", "как будто", "напоминает", "представляю", "вижу", "картина", "существо", "животное", "цвет", "форма", "камень", "вода", "огонь", "свет"],
  message:       ["говорит", "хочет сказать", "послание", "сообщение", "слышу", "слова", "голос", "шепчет", "кричит"],
  life_connection: ["в жизни", "в работе", "в отношениях", "сейчас происходит", "похожая ситуация", "это про", "напоминает ситуацию"],
  // DREAM specific
  atmosphere:    ["атмосфера", "настроение сна", "ощущение сна", "сон был", "снилось"],
  dream_image:   ["видел во сне", "снился", "образ в сне", "персонаж", "место в сне"],
  interaction:   ["подошёл", "дотронулся", "поговорил", "взаимодействовал", "приблизился"],
  // CONFLICT specific
  part_a:        ["одна часть", "часть меня", "с одной стороны", "первая сторона"],
  part_b:        ["другая часть", "другая сторона", "с другой стороны", "вторая часть"],
};

function detectCoveredLayers(messages) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const covered = [];
  for (const [layer, keywords] of Object.entries(LAYER_SIGNALS)) {
    const found = userMessages.some((msg) => keywords.some((kw) => msg.includes(kw)));
    if (found) covered.push(layer);
  }
  return covered;
}

function detectLoopInLastExchanges(messages) {
  // Check last 4 assistant questions for semantic similarity (simple keyword overlap)
  const assistantMsgs = messages
    .filter((m) => m.role === "assistant")
    .slice(-4)
    .map((m) => m.content.toLowerCase());

  if (assistantMsgs.length < 3) return false;

  // Count how many of the last msgs share >3 words
  const wordSets = assistantMsgs.map((m) => new Set(m.split(/\s+/).filter((w) => w.length > 4)));
  let overlapCount = 0;
  for (let i = 1; i < wordSets.length; i++) {
    const intersection = [...wordSets[i]].filter((w) => wordSets[i - 1].has(w));
    if (intersection.length >= 3) overlapCount++;
  }
  return overlapCount >= 2;
}

export async function getAIResponse(session, step, messages, userMessage) {
  // Last 8 messages for context
  const recent = messages.slice(-8);
  const history = recent
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  // Detect covered layers and loop state
  const coveredLayers = detectCoveredLayers(messages);
  const isLooping = detectLoopInLastExchanges(messages);

  const layerStatus = coveredLayers.length > 0
    ? `\n\n━━━ УЖЕ ПРОЙДЕННЫЕ СЛОИ (НЕ возвращайся к ним) ━━━\n${coveredLayers.map((l) => `✓ ${l}`).join("\n")}\n→ Следующий вопрос должен касаться ДРУГОГО слоя.`
    : "";

  const loopWarning = isLooping
    ? `\n\n⚠️ ОБНАРУЖЕНА ПЕТЛЯ: последние несколько ответов слишком похожи. НЕМЕДЛЕННО переходи к следующему слою. Используй: «Похоже, мы хорошо изучили этот уровень. Давай двинемся глубже.»`
    : "";

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

  const prompt = `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}${layerStatus}${loopWarning}

Режим: ${session.mode_id || session.mode}

━━━ ИСТОРИЯ РАЗГОВОРА (все уже отвеченные слои — НЕ повторяй их) ━━━
${history}

━━━ ПОСЛЕДНЕЕ СООБЩЕНИЕ ЧЕЛОВЕКА ━━━
${userMessage}

━━━ ТВОЯ ЗАДАЧА ━━━
1. Сверься со списком УЖЕ ПРОЙДЕННЫХ СЛОЁВ выше.
2. Найди первый слой, которого нет в списке.
3. Ответь: 1 предложение-отражение + 1 вопрос к этому новому слою.
Строго 2–3 предложения. Никаких повторов. Движение вперёд.`;

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