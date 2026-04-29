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

━━━ ЯЗЫК И ОБРАЩЕНИЕ ━━━
ОБЯЗАТЕЛЬНО: всегда обращайся на «ты». Никогда не используй «вы».
Первое сообщение начинай с «Давай начнём», а не «Давайте начнём».
Тон: тёплый, спокойный, уважительный, прямой, неформальный.

━━━ ГЛАВНОЕ ПРАВИЛО: СЛОИ ━━━
Каждый режим имеет строгую последовательность слоёв. Ты ОБЯЗАН отслеживать, какие слои уже пройдены, и НИКОГДА не возвращаться к ним.

ТЕЛО (строгий порядок):
1. локализация (где в теле?)
2. качество (какое ощущение — тяжесть, тепло, сжатие?)
3. движение / импульс (что хочет сделать?)
4. усиление (дай ему больше пространства)
5. образ / существо (если бы стало образом — что это?)
6. голос / послание (что говорит?)
7. связь с жизнью (где это есть в твоей жизни сейчас?)

СОН (строгий порядок — нельзя пропускать шаги):
1. описание / атмосфера сна
2. эмоция / настроение
3. взаимодействие (касание, исследование, контакт с образом)
4. ТРАНСФОРМАЦИЯ ← ОБЯЗАТЕЛЕН, нельзя пропустить
5. послание / голос
6. связь с реальной жизнью

КОНФЛИКТ (строгий порядок):
1. часть А (одна сторона конфликта)
2. часть Б (другая сторона)
3. напряжение между частями
4. что страшно потерять
5. точка интеграции
6. микро-шаг

ДНЕВНИК (строгий порядок):
1. самый сильный сигнал (эмоция / образ / мысль / ощущение)
2. качество сигнала
3. движение / импульс
4. образ или метафора
5. послание
6. связь с жизнью

━━━ АЛГОРИТМ ДЛЯ КАЖДОГО ОТВЕТА ━━━
1. Прочитай историю разговора.
2. Определи, какие слои уже получили ответ.
3. Найди СЛЕДУЮЩИЙ неотвеченный слой.
4. Задай вопрос ТОЛЬКО к этому следующему слою.
5. Никогда не задавай вопрос к уже отвеченному слою — даже в другой формулировке.

━━━ ДЕТЕКТОР ПЕТЛИ ━━━
Если за последние 3–4 обмена тема не продвинулась:
→ НЕМЕДЛЕННО перейди к следующему слою.
→ Скажи: «Похоже, мы хорошо изучили этот слой. Давай двинемся глубже.»

Если человек говорит «ты повторяешься», «я уже сказала», «ты водишь по кругу»:
→ Коротко признай («Да, прости — пойдём дальше») и перейди к следующему слою.

━━━ СТРУКТУРА КАЖДОГО ОТВЕТА ━━━
1. Одно короткое нейтральное отражение (суть того, что сказал человек — 1 предложение).
2. Один точный вопрос к СЛЕДУЮЩЕМУ слою.
Итого: 2–3 предложения. Никогда больше.

━━━ АБСОЛЮТНЫЙ ЗАПРЕТ: НИКАКОЙ ИНТЕРПРЕТАЦИИ ━━━
Ты — фасилитатор, не психолог. Ты исследуешь опыт, а не объясняешь его.

ЗАПРЕЩЁННЫЕ ФРАЗЫ:
✗ «это указывает на...»
✗ «это означает...»
✗ «это говорит о том, что...»
✗ «это связано с...»
✗ «это символизирует...»
✗ «вероятно, это...»
✗ «возможно, это...»
✗ «что это значит для тебя» — только на шаге 6
✗ «что он хочет тебе показать» — только на шаге 5

Вместо интерпретации — нейтральное отражение:
ПЛОХО: «Это указывает на стремление к новому опыту.»
ХОРОШО: «Ты активно тянешься к этому образу и исследуешь его.»

━━━ ТРАНСФОРМАЦИЯ — ШАГ 4 ДЛЯ РЕЖИМА СОН ━━━
Если пользователь описал взаимодействие (трогает, пробует, нюхает, исследует, приближается):
→ ЗАБЛОКИРУЙ переход к посланию и смыслу.
→ ОБЯЗАТЕЛЬНО задай вопрос про трансформацию: что происходит В МОМЕНТ контакта.

Разрешённые вопросы трансформации:
- «Что происходит в момент, когда ты пробуешь этот фрукт?»
- «Что ощущается при касании?»
- «Меняется ли вкус, форма или ощущение?»
- «Есть ли неожиданность или изменение?»
- «Хочется продолжить или остановиться?»

ЗАПРЕЩЕНО на шаге трансформации:
✗ «Что он хочет тебе сказать?» — это шаг 5
✗ «Что это значит для тебя?» — это шаг 6
✗ Любая интерпретация или анализ

━━━ ФОРСИРОВАННЫЙ ПЕРЕХОД ━━━
взаимодействие → трансформация (НЕ послание)
трансформация → послание
послание → связь с жизнью
эмоция → образ или движение (НЕ интерпретация)

━━━ ЗАПРЕЩЕНО В ОБЩЕМ ━━━
✗ Спрашивать о слое, который уже получил ответ
✗ Задавать тот же вопрос другими словами
✗ Давать список вариантов («давление / тепло / сжатие?»)
✗ Начинать с «Я понимаю», «Конечно», «Это важно»
✗ Обращаться на «вы»
✗ Отвечать длиннее 3 предложений
✗ Переходить к смыслу / посланию / связи с жизнью раньше нужного шага

━━━ ПРИМЕРЫ ━━━
Пользователь: «Я хочу их понюхать, потрогать, попробовать»
ПЛОХО: «Что он хочет тебе сказать?»
ХОРОШО: «Когда ты пробуешь этот фрукт — что с тобой происходит? Как меняется твоё состояние?»

Пользователь: «ощущение тяжести в груди»
ПЛОХО: «Это связано с тем, что ты сдерживаешь чувства.»
ХОРОШО: «Если этой тяжести дать чуть больше места — что она хочет сделать?»

━━━ ТОНАЛЬНОСТЬ ━━━
Тихая уверенность. Тепло без слащавости. Профессионализм без дистанции.
Как мудрый, чуткий человек, который видит тебя — и ведёт вперёд, не кружит на месте.`;

// ─── Layer detection & forced progression ────────────────────────────────────

// Keyword signals per layer (checked against all user messages)
const LAYER_SIGNALS = {
  // Universal / BODY
  localization:     ["в груди", "в животе", "в голове", "в плечах", "в спине", "в горле", "в ногах", "в руках", "в шее", "где-то в", "чувствую в"],
  emotion:          ["радость", "грусть", "тревог", "страх", "злость", "раздражение", "спокойствие", "апатия", "интерес", "усталость", "пустот", "радост", "приятно", "неприятно"],
  quality:          ["тяжест", "сжати", "давлени", "пульсац", "вибрац", "твёрд", "мягк", "острое", "тупое", "ноющее", "лёгкость"],
  movement:         ["хочет двигаться", "хочет выйти", "тянет", "толкает", "сжимается", "расширяется", "поднимается", "опускается", "вырваться", "убежать", "остаться", "двигаться", "движение"],
  image:            ["образ", "похоже на", "как будто", "напоминает", "представляю", "вижу", "картина", "существо", "животное", "цвет", "форма", "камень", "вода", "огонь", "свет"],
  message:          ["говорит", "хочет сказать", "послание", "сообщение", "слышу слова", "голос", "шепчет", "кричит", "сказало мне"],
  life_connection:  ["в жизни", "в работе", "в отношениях", "сейчас происходит", "похожая ситуация", "это про", "напоминает ситуацию", "узнаю себя"],
  // DREAM specific
  atmosphere:       ["атмосфера", "настроение сна", "ощущение сна", "сон был", "снилось", "тёмный сон", "яркий сон"],
  dream_image:      ["видел во сне", "снился", "образ в сне", "персонаж", "место в сне", "фрукт", "фрукты", "дерево", "человек во сне"],
  interaction:      ["подошёл", "дотронулся", "поговорил", "взаимодействовал", "приблизился", "попробовал", "пробую", "исследую", "беру", "взял", "трогаю", "касаюсь", "ем", "съел", "нюхаю"],
  transformation:   ["изменилось", "изменился", "стало", "превратилось", "вкус", "неожиданно", "странно", "удивительно", "другим", "иначе", "трансформация", "внезапно"],
  // CONFLICT specific
  part_a:           ["одна часть", "часть меня", "с одной стороны", "первая сторона"],
  part_b:           ["другая часть", "другая сторона", "с другой стороны", "вторая часть"],
};

// Strict forward chains per mode: layer → mandatory next layer
const FORWARD_CHAIN = {
  dream: {
    atmosphere:      "dream_image",
    dream_image:     "interaction",
    interaction:     "transformation",
    transformation:  "message",
    message:         "life_connection",
  },
  body: {
    localization:    "quality",
    emotion:         "movement",
    quality:         "movement",
    movement:        "image",
    image:           "message",
    message:         "life_connection",
  },
  conflict: {
    part_a:          "part_b",
    part_b:          "message",
    message:         "life_connection",
  },
  journaling: {
    emotion:         "image",
    image:           "message",
    message:         "life_connection",
  },
};

// Human-readable next-layer instructions injected into the prompt
const NEXT_LAYER_INSTRUCTIONS = {
  transformation:
    "Следующий слой — ТРАНСФОРМАЦИЯ (шаг 4 из 6, ОБЯЗАТЕЛЕН). " +
    "Пользователь уже описал взаимодействие. Теперь спроси ТОЛЬКО о том, что происходит В МОМЕНТ КОНТАКТА. " +
    "Примеры вопросов: «Что происходит в момент, когда ты пробуешь этот фрукт?», «Какой у него вкус или ощущение?», «Меняется ли что-то в теле в этот момент?», «Есть ли неожиданность или изменение?». " +
    "ЗАПРЕЩЕНО спрашивать про послание, смысл или интерпретацию. Только сенсорный опыт трансформации.",
  message:
    "Следующий слой — ПОСЛАНИЕ (шаг 5 из 6). " +
    "Пользователь прошёл трансформацию. Теперь спроси: если этот образ мог бы что-то сказать — что бы это было? " +
    "НЕ интерпретируй. Только нейтральный вопрос о голосе или послании образа.",
  life_connection:
    "Следующий слой — СВЯЗЬ С ЖИЗНЬЮ (шаг 6 из 6). " +
    "Спроси: где в твоей реальной жизни сейчас есть что-то похожее на этот процесс? " +
    "НЕ интерпретируй. Только нейтральный вопрос о связи.",
  dream_image:
    "Следующий слой — КЛЮЧЕВОЙ ОБРАЗ (шаг 2 из 6). " +
    "Спроси: какой образ из этого сна самый яркий или запоминающийся?",
  interaction:
    "Следующий слой — ВЗАИМОДЕЙСТВИЕ (шаг 3 из 6). " +
    "Спроси: что происходит, когда ты приближаешься к этому образу или вступаешь с ним в контакт?",
  movement:
    "Следующий слой — ДВИЖЕНИЕ / ИМПУЛЬС. Спроси: что это ощущение хочет сделать? Куда оно движется?",
  image:
    "Следующий слой — ОБРАЗ. Спроси: если бы это стало образом или существом — на что бы это было похоже?",
  quality:
    "Следующий слой — КАЧЕСТВО. Спроси: каково это ощущение на ощупь — его текстура, температура, плотность?",
  part_b:
    "Следующий слой — ВТОРАЯ ЧАСТЬ конфликта. Спроси: а что говорит другая сторона — та, которая противостоит первой?",
};

function detectCoveredLayers(messages) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const covered = new Set();
  for (const [layer, keywords] of Object.entries(LAYER_SIGNALS)) {
    if (userMessages.some((msg) => keywords.some((kw) => msg.includes(kw)))) {
      covered.add(layer);
    }
  }
  return covered;
}

// Returns the forced next layer based on the highest covered layer in the chain
function getForcedNextLayer(modeId, coveredLayers) {
  const modeKey = modeId?.toLowerCase().replace(/[^a-z]/g, "") || "";
  // Try to match: dream, body, conflict, journaling
  const chainKey = Object.keys(FORWARD_CHAIN).find((k) => modeKey.includes(k)) || null;
  if (!chainKey) return null;

  const chain = FORWARD_CHAIN[chainKey];
  // Walk the chain: find the deepest covered layer that has a next step
  let forcedNext = null;
  for (const [layer, next] of Object.entries(chain)) {
    if (coveredLayers.has(layer)) {
      forcedNext = next; // keep updating — last (deepest) covered layer wins
    }
  }
  // Don't force a layer that's already covered
  if (forcedNext && coveredLayers.has(forcedNext)) return null;
  return forcedNext;
}

function detectLoopInLastExchanges(messages) {
  const assistantMsgs = messages
    .filter((m) => m.role === "assistant")
    .slice(-4)
    .map((m) => m.content.toLowerCase());

  if (assistantMsgs.length < 3) return false;

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

  // Detect covered layers, forced next step, and loop state
  const coveredLayers = detectCoveredLayers(messages);
  const forcedNext = getForcedNextLayer(session.mode_id || session.mode, coveredLayers);
  const isLooping = detectLoopInLastExchanges(messages);

  const layerStatus = coveredLayers.size > 0
    ? `\n\n━━━ УЖЕ ПРОЙДЕННЫЕ СЛОИ (НЕ возвращайся к ним) ━━━\n${[...coveredLayers].map((l) => `✓ ${l}`).join("\n")}`
    : "";

  const forcedInstruction = forcedNext && NEXT_LAYER_INSTRUCTIONS[forcedNext]
    ? `\n\n🔴 ОБЯЗАТЕЛЬНЫЙ СЛЕДУЮЩИЙ ШАГ: ${NEXT_LAYER_INSTRUCTIONS[forcedNext]}\n` +
      `НЕ задавай вопросы об уже пройденных слоях. Только этот шаг.\n` +
      (forcedNext === "transformation"
        ? `🚫 БЛОКИРОВКА: запрещено спрашивать «что хочет сказать», «что это значит», «что он показывает» — это шаги 5–6. Сейчас только шаг 4: что происходит в момент физического контакта / пробы?`
        : "")
    : "";

  const loopWarning = isLooping
    ? `\n\n⚠️ ПЕТЛЯ ОБНАРУЖЕНА: немедленно переходи к следующему слою. Скажи: «Похоже, мы хорошо изучили этот уровень. Давай двинемся глубже.»`
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

  const prompt = `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}${layerStatus}${forcedInstruction}${loopWarning}

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