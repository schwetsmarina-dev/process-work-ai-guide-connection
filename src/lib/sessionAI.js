import { base44 } from "@/api/base44Client";
import { COMPLETION_SIGNALS, detectCompletionState } from "@/lib/sessionSignals";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

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

// ─── Fetch step from DB — bulletproof lookup ─────────────────────────────────
export async function fetchStep(modeId, stepNumber) {
  const modeIdClean = String(modeId || "").trim();
  const stepNum = Number(stepNumber) || 1;
  const stepKey = `${modeIdClean}_${stepNum}`;

  let all = [];
  try {
    all = await base44.entities.ModeStep.list("step_number", 500);
  } catch (e) {
    console.error(`[FETCH_STEP_DEBUG] ModeStep.list failed: ${e.message}`);
    return null;
  }

  const normalized = all.map((s) => ({
    ...s,
    _modeId: String(s.mode_id || "").trim(),
    _stepKey: String(s.step_key || "").trim(),
    _stepNum: Number(s.step_number) || Number(s.step) || 0,
  }));

  const forMode = normalized.filter((s) => s._modeId === modeIdClean);
  const availableKeys = forMode.map((s) => s._stepKey || `[no key, step_number=${s._stepNum}]`);

  console.log(
    `[FETCH_STEP_DEBUG] modeId="${modeIdClean}" stepNumber=${stepNum} stepKey="${stepKey}" ` +
    `totalRows=${all.length} rowsForMode=${forMode.length} ` +
    `availableStepKeys=[${availableKeys.join(", ")}]`
  );

  if (forMode.length === 0) {
    const allModeIds = [...new Set(normalized.map((s) => s._modeId).filter(Boolean))];
    console.error(`[FETCH_STEP_DEBUG] No rows for mode "${modeIdClean}". DB mode_ids: [${allModeIds.join(", ")}]`);
    return null;
  }

  let match = forMode.find((s) => s._stepKey === stepKey);
  if (match) {
    console.log(`[FETCH_STEP_DEBUG] Found by step_key: "${match._stepKey}"`);
    return match;
  }

  match = forMode.find((s) => s._stepNum === stepNum);
  if (match) {
    console.log(`[FETCH_STEP_DEBUG] Found by step_number=${stepNum}, step_key="${match._stepKey}"`);
    return match;
  }

  match = forMode.find((s) => s._stepKey.endsWith(`_${stepNum}`));
  if (match) {
    console.log(`[FETCH_STEP_DEBUG] Found by step_key suffix "_${stepNum}": "${match._stepKey}"`);
    return match;
  }

  console.error(
    `[FETCH_STEP_DEBUG] NOT FOUND — modeId="${modeIdClean}" stepKey="${stepKey}" ` +
    `availableKeys=[${availableKeys.join(", ")}]`
  );
  return null;
}

// ─── Fetch related terms from DB ─────────────────────────────────────────────
async function fetchRelatedTerms(relatedTermIds) {
  if (!relatedTermIds) return [];
  const ids = relatedTermIds.split(";").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];
  const results = await Promise.all(
    ids.map((tid) => base44.entities.Term.filter({ term_id: tid }))
  );
  return results.flat();
}

// ─── Main AI response ────────────────────────────────────────────────────────
// SYSTEM_PROMPT is imported from @/lib/systemPrompt

// ─── State Machine for Process Mapping ───────────────────────────────────────
function getModeKey(modeId) {
  const lower = (modeId || "").toLowerCase();
  if (lower.includes("dream")) return "dream";
  if (lower.includes("body")) return "body";
  if (lower.includes("conflict")) return "conflict";
  if (lower.includes("journal")) return "journaling";
  return null;
}

const PRIMARY_QUESTION_MARKERS = {
  dream:      ["откликается с твоей реальной жизнью", "привычными чувствами", "знакомыми ситуациями", "больше всего откликается"],
  body:       ["как ты обычно объясняешь", "понятно, знакомо", "связано с твоей обычной жизнью"],
  conflict:   ["более привычная, знакомая", "ближе к тому, как ты обычно"],
  journaling: ["уже понятно, знакомо", "похоже на твой обычный способ"],
};

const SECONDARY_QUESTION_MARKERS = {
  dream:      ["самым странным", "новым, непривычным", "заряженным", "совсем не похожим на тебя"],
  body:       ["странное, необычное", "неожиданное", "не совсем твоё"],
  conflict:   ["более новая, непривычная", "труднее принимается", "больше напряжения"],
  journaling: ["новым, странным, живым", "тревожащим, непривычным", "пока не до конца понятным"],
};

const DREAM_INVITE_MARKERS = [
  "расскажи", "расскажи мне свой сон", "расскажи сон", "расскажи его",
  "как ты его помнишь", "какие моменты", "что тебе запомнилось",
];

const DREAM_ALREADY_TOLD_SIGNALS = [
  "рассказала же", "рассказал же",
  "я уже рассказала", "я уже рассказал",
  "я уже сказала", "я уже сказал",
  "я же рассказала", "я же рассказал",
  "уже рассказывала", "уже рассказывал",
  "почему ты снова спрашиваешь", "ты опять спрашиваешь",
  "ты уже спрашивал", "ты уже спрашивала",
  "я уже написала", "я уже написал",
  "опять то же самое",
];

function detectDreamAlreadyTold(userMessage) {
  const lower = userMessage.toLowerCase();
  return DREAM_ALREADY_TOLD_SIGNALS.some((sig) => lower.includes(sig));
}

const MISMATCH_SIGNALS = [
  "я ещё не рассказала", "я ещё не рассказал", "я не рассказывала",
  "ты перескочил", "ты перескочила", "откуда это", "это не то",
  "это не про то", "я этого не говорила", "я этого не говорил",
  "я не говорила про", "я не говорил про",
  "что ещё за", "откуда ты взял", "откуда ты взяла",
  "я не упоминала", "я не упоминал",
  "ты путаешь", "не об этом", "не про это",
  "вернись", "подожди", "стоп",
];

const MAP_STATUS_SIGNALS = [
  "у тебя уже есть", "ты уже знаешь", "есть ли у тебя", "что ты знаешь",
  "первичный процесс", "вторичный процесс", "карта", "карту",
  "разве мы уже", "мы наметили", "ты уже понял", "ты уже поняла",
  "понятие о моём", "понятие о моем",
];

function detectMismatch(userMessage) {
  const lower = userMessage.toLowerCase();
  return MISMATCH_SIGNALS.some((sig) => lower.includes(sig));
}

function detectMapStatusQuery(userMessage) {
  const lower = userMessage.toLowerCase();
  return MAP_STATUS_SIGNALS.some((sig) => lower.includes(sig));
}

function detectDreamContent(messages) {
  const userMsgs = messages.filter((m) => m.role === "user");
  const combined = userMsgs.map((m) => m.content.toLowerCase()).join(" ");

  const FULL_NARRATIVE = [
    "снилось","приснился","приснилась","приснилось","мне приснил",
    "во сне","был сон","была во сне","был во сне","я шла","я шёл",
    "стояла","стоял","пришёл","пришла","увидела","увидел",
    "оказалась","оказался","появился","появилась",
  ];
  const CLUSTER = [
    "снятся сны","мне снятся","последнее время снятся","часто снятся",
    "повторяющийся сон","снятся похожие сны","серия снов","несколько снов",
    "снился сон",
    "снятся разные сны", "снились сны", "снились разные",
  ];
  const THEME = [
    "сон про ", "сон о ", "сны про ", "сны о ",
    "сны, связанные", "снятся сны, связанные",
    "сон был про", "сон с ",
    "сны об ",
  ];
  const EMOTION_IN_DREAM = [
    "в этих снах", "в этом сне", "из снов", "из этих снов",
    "во снах", "эти сны",
  ];

  const allGroups = [
    { reason: "full_narrative", signals: FULL_NARRATIVE },
    { reason: "dream_cluster",  signals: CLUSTER },
    { reason: "dream_theme",    signals: THEME },
    { reason: "dream_emotion",  signals: EMOTION_IN_DREAM },
  ];

  let matchedSignal = null;
  let reason = "none";

  for (const group of allGroups) {
    const hit = group.signals.find((sig) => combined.includes(sig));
    if (hit) {
      matchedSignal = hit;
      reason = group.reason;
      break;
    }
  }

  console.log("[DREAM_STAGE_DEBUG]", {
    dreamMaterialDetected: !!matchedSignal,
    reason,
    totalUserMessages: userMsgs.length,
    matchedSignal: matchedSignal || null,
  });

  return { hasDreamContent: !!matchedSignal, reason, matchedSignal };
}

function detectProcessMappingStage(messages, modeId) {
  const modeKey = getModeKey(modeId);
  if (!modeKey) return { stage: "complete", primary_answer: null, secondary_answer: null, dream_shared: true };

  const primaryMarkers = PRIMARY_QUESTION_MARKERS[modeKey] || [];
  const secondaryMarkers = SECONDARY_QUESTION_MARKERS[modeKey] || [];

  const isDream = modeKey === "dream";
  const dreamResult = isDream ? detectDreamContent(messages) : { hasDreamContent: true, reason: "n/a", matchedSignal: null };
  const dream_shared = dreamResult.hasDreamContent;

  if (isDream && !dream_shared) {
    return { stage: "awaiting_dream", primary_answer: null, secondary_answer: null, dream_shared: false };
  }

  let primaryQuestionIndex = -1;
  let secondaryQuestionIndex = -1;

  messages.forEach((m, i) => {
    if (m.role !== "assistant") return;
    const lower = m.content.toLowerCase();
    if (primaryQuestionIndex === -1 && primaryMarkers.some((marker) => lower.includes(marker))) {
      primaryQuestionIndex = i;
    }
    if (secondaryQuestionIndex === -1 && secondaryMarkers.some((marker) => lower.includes(marker))) {
      secondaryQuestionIndex = i;
    }
  });

  const primaryQuestionAsked = primaryQuestionIndex !== -1;
  const secondaryQuestionAsked = secondaryQuestionIndex !== -1;

  let primary_answer = null;
  let secondary_answer = null;

  if (primaryQuestionAsked) {
    const afterPrimary = messages.slice(primaryQuestionIndex + 1).find((m) => m.role === "user");
    if (afterPrimary) primary_answer = afterPrimary.content;
  }

  if (secondaryQuestionAsked) {
    const afterSecondary = messages.slice(secondaryQuestionIndex + 1).find((m) => m.role === "user");
    if (afterSecondary) secondary_answer = afterSecondary.content;
  }

  if (!primaryQuestionAsked || !primary_answer) {
    return { stage: "awaiting_primary", primary_answer, secondary_answer, dream_shared };
  }
  if (!secondaryQuestionAsked || !secondary_answer) {
    return { stage: "awaiting_secondary", primary_answer, secondary_answer, dream_shared };
  }
  return { stage: "complete", primary_answer, secondary_answer, dream_shared };
}

// ─── Process Map (for dream map context display) ──────────────────────────────
function buildProcessMap(messages, modeId) {
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content.toLowerCase()).join(" ");
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");

  const map = {
    primary_process: null,
    secondary_process: null,
    edge: null,
    field_figures: null,
    channels: null,
    emerging_quality: null,
    polarity: null,
    atmosphere: null,
  };

  const stage = detectProcessMappingStage(messages, modeId);
  if (stage.primary_answer) map.primary_process = stage.primary_answer.substring(0, 80);
  if (stage.secondary_answer) map.secondary_process = stage.secondary_answer.substring(0, 80);

  if (allText.includes("граница") || allText.includes("границ") || allText.includes("колебани") ||
      allText.includes("с одной стороны") || allText.includes("но с другой")) {
    map.edge = "колебание между первичным и вторичным";
  }

  const figureSignals = ["мать", "мама", "папа", "отец", "муж", "жена", "партнёр", "начальник",
    "друг", "подруга", "ребёнок", "дети", "коллег", "учитель", "босс", "родители"];
  const foundFigures = figureSignals.filter((f) => userText.includes(f));
  if (foundFigures.length > 0) map.field_figures = foundFigures.join(", ");

  const channelSignals = [
    ["образ", "визуальный"], ["вижу", "визуальный"],
    ["движени", "моторный"], ["голос", "аудиальный"],
    ["во сне", "сновидческий"], ["снилось", "сновидческий"],
  ];
  const foundChannels = new Set();
  for (const [kw, channel] of channelSignals) {
    if (allText.includes(kw)) foundChannels.add(channel);
  }
  if (foundChannels.size > 0) map.channels = [...foundChannels].join(", ");

  const emergingSignals = [
    ["проявиться", "импульс проявиться"], ["свобод", "свобода"],
    ["целостност", "целостность"], ["зрелост", "зрелость"],
    ["готовност", "готовность к новому"],
  ];
  for (const [kw, label] of emergingSignals) {
    if (allText.includes(kw)) { map.emerging_quality = label; break; }
  }

  if (map.primary_process && map.secondary_process) {
    map.polarity = "присутствует напряжение между знакомым и новым";
  }

  const atmoSignals = [
    ["тяжёл", "тяжёлая"], ["грустн", "грустная"], ["тревожн", "тревожная"],
    ["светл", "светлая"], ["спокойн", "спокойная"], ["напряжённ", "напряжённая"],
    ["радостн", "радостная"], ["тёпл", "тёплая"], ["запутанн", "запутанная"],
  ];
  for (const [kw, label] of atmoSignals) {
    if (userText.includes(kw)) { map.atmosphere = label; break; }
  }

  return map;
}

function buildDreamProcessMap(messages) {
  return buildProcessMap(messages, "dream");
}

function countMapFields(map) {
  return Object.values(map).filter((v) => v !== null).length;
}

function formatProcessMapForPrompt(map, filledCount) {
  const lines = [];
  if (map.primary_process) lines.push(`— первичный процесс: ${map.primary_process}`);
  if (map.secondary_process) lines.push(`— вторичный процесс: ${map.secondary_process}`);
  if (map.polarity) lines.push(`— полярность/напряжение: ${map.polarity}`);
  if (map.atmosphere) lines.push(`— эмоциональная атмосфера: ${map.atmosphere}`);
  if (map.field_figures) lines.push(`— важные фигуры поля: ${map.field_figures}`);
  if (map.emerging_quality) lines.push(`— зарождающееся/неизведанное качество: ${map.emerging_quality}`);
  if (map.edge) lines.push(`— грань (edge): ${map.edge}`);
  if (map.channels) lines.push(`— задействованные каналы: ${map.channels}`);

  const complete = map.primary_process && map.secondary_process;
  return lines.length > 0
    ? lines.join("\n") + (complete ? "\n\n✅ Первичный и вторичный процессы определены." : "\n\n⚠ Первичный/вторичный ещё не определены через отдельные вопросы.")
    : "(карта пуста — уточняющие вопросы ещё не заданы)";
}

// ─── Layer detection & forced progression ────────────────────────────────────
const LAYER_SIGNALS = {
  process_mapping:  ["хочу посмотреть", "интереснее", "более живое", "притягивает", "хочу туда", "хочу глубже", "непривычное", "удивляет", "больше отклика", "больше живости", "куда хочется", "пойти в", "интересно именно", "выбираю"],
  localization:     ["в груди", "в животе", "в голове", "в плечах", "в спине", "в горле", "в ногах", "в руках", "в шее", "где-то в", "чувствую в"],
  emotion:          ["радость", "грусть", "тревог", "страх", "злость", "раздражение", "спокойствие", "апатия", "интерес", "усталость", "пустот", "радост", "приятно", "неприятно"],
  quality:          ["тяжест", "сжати", "давлени", "пульсац", "вибрац", "твёрд", "мягк", "острое", "тупое", "ноющее", "лёгкость"],
  movement:         ["хочет двигаться", "хочет выйти", "тянет", "толкает", "сжимается", "расширяется", "поднимается", "опускается", "вырваться", "убежать", "остаться", "двигаться", "движение"],
  image:            ["образ", "похоже на", "как будто", "напоминает", "представляю", "вижу", "картина", "существо", "животное", "цвет", "форма", "камень", "вода", "огонь", "свет"],
  message:          ["говорит", "хочет сказать", "послание", "сообщение", "слышу слова", "голос", "шепчет", "кричит", "сказало мне"],
  life_connection:  ["в жизни", "в работе", "в отношениях", "сейчас происходит", "похожая ситуация", "это про", "напоминает ситуацию", "узнаю себя"],
  atmosphere:       ["атмосфера", "настроение сна", "ощущение сна", "сон был", "снилось", "тёмный сон", "яркий сон"],
  dream_image:      ["видел во сне", "снился", "образ в сне", "персонаж", "место в сне", "фрукт", "фрукты", "дерево", "человек во сне"],
  interaction:      ["подошёл", "дотронулся", "поговорил", "взаимодействовал", "приблизился", "попробовал", "пробую", "исследую", "беру", "взял", "трогаю", "касаюсь", "ем", "съел", "нюхаю"],
  transformation:   ["изменилось", "изменился", "стало", "превратилось", "вкус", "неожиданно", "странно", "удивительно", "другим", "иначе", "трансформация", "внезапно"],
  part_a:           ["одна часть", "часть меня", "с одной стороны", "первая сторона"],
  part_b:           ["другая часть", "другая сторона", "с другой стороны", "вторая часть"],
  // IMMERSION signals — user staying with and unfolding the process
  immersion:        ["что начинает происходить", "остаюсь рядом", "меняется состояние", "становится сильнее", "разворачивается внутри", "переживаю это", "не отталкиваю", "погружаюсь", "остаюсь с этим", "замечаю изменения", "продолжает меняться", "нахожусь внутри", "интенсивнее", "усиливается", "нарастает"],
  // INTEGRATION signals — user expressing these AFTER a strong state has emerged (universal + conflict-specific)
  integration:      ["я меняюсь", "меняется", "чувствую себя целостн", "чувствую целостн", "я вижу иначе", "стала иначе", "что-то изменилось во мне", "внутри что-то изменилось", "я чувствую зрелость", "чувствую безопасность", "я стала", "я становлюсь", "ощущение целостност", "состояние целостност", "состояние зрелост", "состояние безопасност", "я уже другая", "что-то открылось", "как будто открывается", "появилась ясность", "стало яснее", "я вижу по-другому",
    "становится легче", "мне легче", "чувствую взаимность", "взаимность", "мне спокойнее", "стало спокойнее", "чувствую спокойствие", "появилось спокойствие", "стало легче", "облегчение", "чувствую облегчение", "ясность появляется", "что-то проясняется", "начинает проясняться", "больше понимаю", "стало понятнее", "появилось понимание", "чувствую опору", "появилась опора", "чувствую себя увереннее", "стала увереннее"],
};

// Strict forward chains per mode: layer → mandatory next layer
const FORWARD_CHAIN = {
  dream: {
    process_mapping: "atmosphere",
    atmosphere:      "dream_image",
    dream_image:     "interaction",
    interaction:     "transformation",
    transformation:  "immersion",
    immersion:       "message",
    message:         "life_connection",
  },
  body: {
    process_mapping: "localization",
    localization:    "quality",
    emotion:         "movement",
    quality:         "movement",
    movement:        "image",
    image:           "immersion",
    immersion:       "message",
    message:         "life_connection",
  },
  conflict: {
    process_mapping: "part_a",
    part_a:          "part_b",
    part_b:          "immersion",
    immersion:       "message",
    message:         "life_connection",
  },
  journaling: {
    process_mapping: "emotion",
    emotion:         "image",
    image:           "immersion",
    immersion:       "message",
    message:         "life_connection",
  },
};

const NEXT_LAYER_INSTRUCTIONS = {
  process_mapping:
    "Следующий шаг — КАРТИРОВАНИЕ ПРОЦЕССА (Этап 0, ОБЯЗАТЕЛЕН перед любым углублением). " +
    "1. Мягко обозначь гипотезу: что в принесённом материале кажется более знакомым/устойчивым (первичное), а что — новым/удивляющим/напряжённым (вторичное). " +
    "Используй только гипотетический язык: «Похоже, одна часть...», «А другая как будто...». " +
    "2. Если есть заметное колебание или напряжение — отрази: «Как будто здесь есть граница между привычным и чем-то новым.» " +
    "3. Задай ОДИН вопрос ориентации (выбери наиболее подходящий): " +
    "«Где из этого сейчас больше отклика или живости?» / " +
    "«Что кажется более непривычным или притягивающим?» / " +
    "«Куда тебе хочется посмотреть глубже?» " +
    "НЕ углубляй самый приятный материал автоматически. Жди ответа пользователя. " +
    "ЗАПРЕЩЕНО: интерпретировать, советовать, переходить к слоям процесса до получения ответа на вопрос ориентации.",
  transformation:
    "Следующий слой — ТРАНСФОРМАЦИЯ (шаг 4 из 7, ОБЯЗАТЕЛЕН). " +
    "Пользователь уже описал взаимодействие. Теперь спроси ТОЛЬКО о том, что происходит В МОМЕНТ ЭТОГО ДЕЙСТВИЯ. " +
    "Используй ТОЧНЫЕ слова пользователя из его последнего сообщения — ни одного слова, которого он не использовал. " +
    "Шаблон: «Когда ты [глагол пользователя] [объект пользователя] — что происходит в этот момент? Что меняется?» " +
    "ЗАПРЕЩЕНО: вводить вкус, касание, контакт, запах, текстуру, если пользователь их не упоминал. " +
    "ЗАПРЕЩЕНО спрашивать про послание, смысл или интерпретацию. Только то, что происходит прямо сейчас в действии.",
  immersion:
    "Следующий слой — РАЗВЁРТЫВАНИЕ / ИММЕРСИЯ (обязательный этап перед посланием). " +
    "Процесс ещё не готов к голосу или смыслу. Выбери ОДИН тип интервенции из списка ниже — тот, который наиболее соответствует текущему состоянию пользователя. НЕ повторяй тот же тип, что уже использовался.\n\n" +
    "ТИПЫ ИНТЕРВЕНЦИЙ (выбирай динамически):\n" +
    "A) ИММЕРСИЯ: 'Если ты продолжаешь находиться в этом [слово пользователя] — что происходит с тобой?' / 'Как развивается это переживание?'\n" +
    "B) УСИЛЕНИЕ: 'Если позволить этому [слово] стать чуть сильнее — что начинает происходить?' / 'Что раскрывается, если не сдерживать это?'\n" +
    "C) ТЕЛО/РЕСУРС: 'Как тело реагирует на это?' / 'Есть ли место, где телу чуть устойчивее?'\n" +
    "D) ГРАНЬ: 'Что в этом пока трудно выдерживать?' / 'Что мешает полностью войти в это?'\n" +
    "E) ПОЛЯРНОСТЬ: 'Какая часть хочет оставаться по-старому — а какая уже не может?'\n" +
    "F) ДВИЖЕНИЕ: 'Что хочет сделать это ощущение? Есть ли импульс — куда это движется?'\n" +
    "G) АТМОСФЕРА: 'Какая атмосфера появляется вокруг этого?' / 'На что похоже это пространство?'\n\n" +
    "ЯЗЫКОВОЕ ПРАВИЛО: НЕ используй 'рядом с этим состоянием' или 'внутри этого состояния' — это неестественно. Используй: 'в этом страхе', 'в этом [слово пользователя]', 'с этим переживанием'.\n" +
    "ЗАПРЕЩЕНО: 'что бы это сказало?', 'какое у этого послание?', 'что это хочет сказать?' — это преждевременно.\n" +
    "ЗАПРЕЩЕНО: интерпретировать, делать выводы, переходить к смыслу или символике.",
  message:
    "Следующий слой — ПОСЛАНИЕ / ГОЛОС (шаг 6 из 7). " +
    "Пользователь прошёл иммерсию. Теперь можно перейти к голосу/посланию того элемента процесса, который уже был выбран и достаточно развёрнут: образа, ощущения, части конфликта, состояния, импульса или фигуры. " +
    "Используй точные слова пользователя. Не вводи новый объект. НЕ интерпретируй. Только нейтральный вопрос о голосе или послании. " +
    "Примеры (только как структура, не как шаблон): " +
    "сон — 'Если бы [конкретный образ из слов пользователя] мог что-то сказать — что бы это было?'; " +
    "тело — 'Если бы это [название ощущения из слов пользователя] могло говорить — что бы оно сказало?'; " +
    "конфликт — 'Если бы та часть, которая [точные слова пользователя], могла говорить — что бы она сказала?'; " +
    "дневник — 'Если бы это состояние [точные слова пользователя] могло что-то сказать — что бы это было?'.",
  life_connection:
    "Следующий слой — ИНТЕГРАЦИЯ С ЖИЗНЬЮ (финальный). " +
    "Послание уже получено. Теперь веди к реальной жизни: " +
    "«Насколько это состояние — [конкретные слова пользователя] — уже есть в твоей жизни?» или " +
    "«Где сейчас его не хватает?» или " +
    "«Как могла бы измениться твоя жизнь, если бы ты жила из этого состояния?». " +
    "НЕ возвращайся к образу, взаимодействию или описанию. Только интеграция и будущий сдвиг. " +
    "После ответа пользователя — завершай сессию инсайтом и опциональным вопросом о фиксации.",
  dream_image:
    "Следующий слой — КЛЮЧЕВОЙ ОБРАЗ (шаг 2 из 7). " +
    "Спроси: какой образ из этого сна самый яркий или запоминающийся?",
  interaction:
    "Следующий слой — ВЗАИМОДЕЙСТВИЕ / ОТНОШЕНИЕ (шаг 3 из 7). " +
    "Спроси о том, что происходит между пользователем и выбранным элементом сна — через тот канал, который уже активен в его словах: взгляд, расстояние, приближение, движение, речь, молчание или телесное ощущение. " +
    "НЕ вводи «контакт», «касание», «прикосновение» если пользователь их не упоминал. " +
    "Пример: если пользователь сказал «я вижу его» — спроси про взгляд или расстояние. Если «я подхожу ближе» — спроси что начинает происходить при приближении.",
  movement:
    "Следующий слой — ДВИЖЕНИЕ / ИМПУЛЬС. Спроси: что это ощущение хочет сделать? Куда оно движется?",
  image:
    "Следующий слой — ОБРАЗ. Спроси: если бы это стало образом или существом — на что бы это было похоже?",
  quality:
    "Следующий слой — КАЧЕСТВО телесного сигнала. Спроси о качестве через канал, который уже активен в словах пользователя. " +
    "Если пользователь описал тяжесть — спроси о характере тяжести. Если давление — о том, какое оно. " +
    "НЕ вводи текстуру, температуру или прикосновение, если пользователь их не упомянул.",
  part_b:
    "Следующий слой — ВТОРАЯ ЧАСТЬ конфликта. Спроси: а что говорит другая сторона — та, которая противостоит первой?",
};

// ─── Primary Process Thread detection ────────────────────────────────────────
const PRIMARY_STATE_SIGNALS = [
  { keywords: ["зрелост", "зрелая", "зрелый", "беременн", "готовност", "готова", "готов"], label: "зрелость и готовность" },
  { keywords: ["уверенност", "уверенная", "уверен", "опора", "устойчивост"], label: "уверенность и опора" },
  { keywords: ["целостност", "целостная", "целостный", "интеграц"], label: "целостность" },
  { keywords: ["направленност", "стрела", "движение вперёд", "действие", "действуй", "действую", "импульс", "вектор"], label: "направленность и действие" },
  { keywords: ["тепло", "тёплое", "согревающее", "центр", "центральное"], label: "центрированное тепло" },
  { keywords: ["спокойстви", "покой", "умиротворени"], label: "покой и спокойствие" },
  { keywords: ["свобод", "освобождени", "лёгкость", "простор"], label: "свобода и лёгкость" },
  { keywords: ["сил", "энергия", "наполненност", "живост"], label: "сила и энергия" },
];

const SECONDARY_MATERIAL_SIGNALS = [
  "тревог", "страх", "беспокойств", "сомнени", "неуверенност",
  "боюсь", "боится", "пугает", "напряжени", "тяжело", "трудно", "сложно",
];

function detectPrimaryProcessThread(messages) {
  const assistantMsgs = messages
    .filter((m) => m.role === "assistant")
    .slice(2);

  if (assistantMsgs.length < 2) return null;

  const combined = assistantMsgs.map((m) => m.content.toLowerCase()).join(" ");

  for (const signal of PRIMARY_STATE_SIGNALS) {
    if (signal.keywords.some((kw) => combined.includes(kw))) {
      return signal.label;
    }
  }
  return null;
}

function detectSecondaryMaterialInLatestMessage(userMessage) {
  const lower = userMessage.toLowerCase();
  return SECONDARY_MATERIAL_SIGNALS.some((kw) => lower.includes(kw));
}

function detectIntegrationStage(messages) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());
  const signals = LAYER_SIGNALS.integration;
  return userMessages.some((msg) => signals.some((kw) => msg.includes(kw)));
}

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

// ─── Resistance / Edge detection ────────────────────────────────────────────
const RESISTANCE_SIGNALS = [
  "не хочу", "не могу", "не знаю", "не готова", "не готов",
  "не получается", "не могу туда идти", "не хочу туда",
  "слишком тяжело", "слишком сложно", "невыносимо",
  "я устала", "устала", "устал", "хватит", "стоп",
  "давай закончим", "не хочу продолжать",
  "я повторяюсь", "ты повторяешь", "я уже ответила", "я уже сказала",
  "я вынуждена повторять",
  "ничего", "нет", "не знаю",
];

function detectResistanceCount(messages) {
  const recentUser = messages.filter((m) => m.role === "user").slice(-6);
  let count = 0;
  for (const msg of recentUser) {
    const lower = msg.content.toLowerCase().trim();
    const hasSignal = RESISTANCE_SIGNALS.some((sig) => lower.includes(sig));
    // Short stuck answers (<=15 chars, no question mark) also count
    const isShortStuck = lower.length <= 15 && !lower.includes("?");
    if (hasSignal || isShortStuck) count++;
  }
  return count;
}

function getForcedNextLayer(modeId, coveredLayers) {
  const modeKey = modeId?.toLowerCase().replace(/[^a-z]/g, "") || "";
  const chainKey = Object.keys(FORWARD_CHAIN).find((k) => modeKey.includes(k)) || null;
  if (!chainKey) return null;

  const chain = FORWARD_CHAIN[chainKey];
  let forcedNext = null;
  for (const [layer, next] of Object.entries(chain)) {
    if (coveredLayers.has(layer)) {
      forcedNext = next;
    }
  }
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

// ─── Response validation ──────────────────────────────────────────────────────
const FORBIDDEN_PHRASES = [
  "этот образ", "этот элемент", "данный объект",
  "это означает", "это указывает на", "это говорит о том", "это связано с",
  "давайте", "давайте начнём",
  "как образ", "каким образом это могло бы проявиться", "какой метафорой",
];

const TRANSFORMATION_VALID_KEYWORDS = [
  "что происходит", "что меняется", "что изменяется",
  "неожиданн", "удивительн", "странн",
  "хочется продолжить", "хочется остановиться", "что тянет",
];

const TRANSFORMATION_INVALID_PHRASES = [
  "что это значит", "что он хочет сказать", "что это показывает",
  "какое послание", "где это в жизни", "каким образом это связано",
];

const INTEGRATION_INVALID_PHRASES = [
  "каким образом это стало бы образом", "если бы это было метафорой",
  "что этот образ хочет сказать", "какое движение появляется", "где в теле",
  "каким образом это могло бы проявиться", "какой метафорой",
  "если бы это стало образом", "если бы стало образом", "если бы это было образом",
  "каким образом ты видишь", "какой образ", "представь образ",
  "метафор", "символ", "телесн",
  "что говорит часть", "что хочет часть", "вернёмся к части", "вернись к части",
  "что чувствует та часть", "та часть говорит", "другая часть говорит",
  "что хочет сказать часть", "голос части",
];

const EDGE_LIMIT_FALLBACK = "Похоже, сейчас важнее не идти глубже, а заметить сам момент остановки. Давай не будем тащить процесс через силу — сам факт остановки тоже может быть частью процесса. Что для тебя было самым важным в этой сессии?";

const SAFE_FALLBACKS = {
  awaiting_dream: "Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?",
  awaiting_primary: "Если смотреть на этот сон целиком — что в нём больше всего откликается с твоей реальной жизнью, привычными чувствами или знакомыми состояниями?",
  awaiting_secondary: "А что в этом сне кажется тебе самым непривычным, странным, новым или не совсем похожим на тебя?",
  mismatch_dream: "Ты права, я перескочил вперёд. Сначала важно услышать сам сон целиком. Расскажи его так, как он тебе запомнился.",
  transformation: "Давай останемся именно в моменте действия. Что происходит прямо сейчас — есть ли что-то неожиданное или меняющееся?",
  immersion: "Давай не будем идти глубже автоматически. Что сейчас помогает тебе оставаться в контакте с собой?",
  integration: "Похоже, здесь уже открылось важное состояние. Насколько оно есть в твоей жизни сейчас, а где его пока не хватает?",
  conflict_integration: "Похоже, внутри появляется больше спокойствия и опоры. Как это влияет на твоё ощущение — что становится более честным по отношению к себе?",
  body: "Давай останемся рядом с самим ощущением. Что в нём сейчас самое заметное?",
  conflict: "Давай удержим обе стороны. Что становится яснее, если дать место каждой из них?",
  journaling: "Давай возьмём то, что уже проявилось, и свяжем это с жизнью. Где это сейчас особенно откликается?",
  dream_mapping: "Давай продолжим намечать карту. Что в этом сне кажется более знакомым или устойчивым — а что удивляет или тянет, как будто что-то новое?",
};

function validateAssistantResponse({ responseText, currentMode, forcedNextLayer, integrationLock, conversationHistory, lastUserMessage, dreamMappingComplete, mappingStageValue, userSelectedFocus, completionDetected, coveredLayers, resistanceCount }, validationContext) {
  if (!validationContext) validationContext = { completionDetected };
  const lower = responseText.toLowerCase();

  // 0. EDGE LIMIT check — must run before all other checks
  if ((resistanceCount || 0) >= 3) {
    const DEEPENING_PHRASES = [
      "что происходит", "что начинает происходит", "что начинает происходить", "как меняется",
      "что становится сильнее", "если усилить", "если продолжать находиться",
      "что раскрывается", "куда это ведёт", "что хочет проявиться",
      "давай исследуем", "пойдём глубже",
      "позволь себе", "попробуй остаться", "погрузись",
    ];
    const hit = DEEPENING_PHRASES.find((p) => lower.includes(p));
    if (hit) {
      console.warn("[EDGE_LIMIT_REACHED]", { resistanceCount, processStopped: true, closureStarted: true, triggeredPhrase: hit });
      return {
        isValid: false,
        reason: `EDGE_LIMIT_REACHED: deepening phrase "${hit}" after ${resistanceCount} resistance signals`,
        correctedInstruction:
          "EDGE LIMIT REACHED. Stop deepening. Respect the user's edge. " +
          "Acknowledge it warmly: 'Похоже, сейчас это место становится слишком трудным.' or 'Давай не будем тащить процесс через силу.' " +
          "Then ask ONE memory-knot question only: 'Что для тебя было самым важным в этой сессии?' or 'Какой инсайт тебе хочется сохранить?' or 'Что сейчас кажется самым ценным?'",
      };
    }
  }


  // 0a. Awaiting-dream gate
  if (mappingStageValue === "awaiting_dream") {
    const prematurePhrases = [
      "что в этом сне тебе кажется знакомым", "что из этого сна больше всего откликается",
      "что в этом сне кажется", "что в этом сне",
      "первичный процесс", "вторичный процесс",
      "где ты ощущаешь", "в теле", "в груди", "в животе",
      "что ты чувствуешь", "что ощущаешь", "какой образ",
      "что хочет сказать", "что это значит",
    ];
    for (const phrase of prematurePhrases) {
      if (lower.includes(phrase)) {
        return {
          isValid: false,
          reason: `Awaiting-dream gate violated: mapping/exploration question asked before dream was shared ("${phrase}")`,
          correctedInstruction: "The user has NOT shared their dream yet. The ONLY valid response is to invite the dream narrative: 'Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?' Do not ask anything else.",
        };
      }
    }
  }

  // 0b. Somatic gate
  if (dreamMappingComplete === false) {
    const somaticPhrases = ["где ты ощущаешь", "ощущаешь в теле", "что ты чувствуешь телесно",
      "телесный отклик", "в теле", "в груди", "в животе", "в горле", "в плечах"];
    for (const phrase of somaticPhrases) {
      if (lower.includes(phrase)) {
        return {
          isValid: false,
          reason: `Somatic gate violated: body question asked before primary/secondary process clarification is complete ("${phrase}")`,
          correctedInstruction: "Primary and secondary process have NOT yet been clarified through separate questions. Do NOT ask body/somatic questions. Ask the missing clarifying question first.",
        };
      }
    }
  }

  // 1. Global forbidden phrases check
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        isValid: false,
        reason: `Forbidden phrase detected: "${phrase}"`,
        correctedInstruction: "Remove interpretation and forbidden phrases. Use the user's concrete words. Do not say 'этот образ', do not interpret, do not use 'Давайте'.",
      };
    }
  }

  // 2. Anti-interpretation
  const interpretationPhrases = ["это означает", "это указывает на", "это говорит о том", "это связано с"];
  for (const phrase of interpretationPhrases) {
    if (lower.includes(phrase)) {
      return {
        isValid: false,
        reason: `Interpretation phrase: "${phrase}"`,
        correctedInstruction: "Remove interpretation. Use neutral reflection only.",
      };
    }
  }

  // 3. Integration lock validation
  if (integrationLock) {
    for (const phrase of INTEGRATION_INVALID_PHRASES) {
      if (lower.includes(phrase)) {
        return {
          isValid: false,
          reason: `Integration lock violated: returned to earlier layer ("${phrase}")`,
          correctedInstruction: "Integration lock is active. Do not return to image, body, metaphor, symbol or interaction. Ask only about real-life integration, future shift or closure.",
        };
      }
    }
  }

  // 3.5. Premature voice channel check: block message/voice questions before immersion phase
  const VOICE_CHANNEL_PHRASES_PREMATURE = [
    "что бы это сказало", "если бы у этого был голос", "какое у этого послание",
    "что это хочет тебе сказать", "что это хочет сказать", "что хочет сказать",
    "какое послание", "что бы оно сказало", "голос этого",
    "что пытается сказать", "что говорит этот образ", "что он хочет тебе сказать",
    "что она хочет тебе сказать", "что хочет этот образ сказать",
  ];
  const immersionCoveredCheck = coveredLayers ? coveredLayers.has("immersion") : false;

  // 3.6. Intervention repetition check — block same intervention pattern used 2+ times in a row
  const lastThreeAssistant = (conversationHistory || [])
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content.toLowerCase());
  const REPETITIVE_IMMERSION_PHRASES = [
    "остаёшься рядом с этим", "рядом с этим состоянием", "внутри этого состояния",
    "что начинает происходить, когда ты остаёшься",
  ];
  if (lastThreeAssistant.length >= 2) {
    const repetitionHits = lastThreeAssistant.filter((msg) =>
      REPETITIVE_IMMERSION_PHRASES.some((p) => msg.includes(p))
    );
    if (repetitionHits.length >= 2) {
      const triggeredPhrase = REPETITIVE_IMMERSION_PHRASES.find((p) =>
        repetitionHits[repetitionHits.length - 1].includes(p)
      );
      console.warn("[INTERVENTION_DIVERSITY_CHECK]", {
        interventionType: "immersion_repetition",
        repetitionDetected: true,
        triggeredPhrase,
      });
      return {
        isValid: false,
        reason: `Intervention repetition detected: same immersion pattern used 2+ times ("${triggeredPhrase}")`,
        correctedInstruction:
          "REPETITION BLOCKED. You have used the same immersion phrase multiple times. " +
          "Choose a DIFFERENT intervention type: amplification (усиление), body resource (тело/опора), " +
          "edge work (грань), polarity (полярность), movement impulse (импульс), or field atmosphere (атмосфера). " +
          "Also avoid unnatural phrases like 'рядом с этим состоянием' or 'внутри этого состояния'. " +
          "Use natural Russian: 'Если ты продолжаешь находиться в этом [слово]...', 'Что меняется, когда ты это не отгоняешь?'",
      };
    }
  }
  const interactionCoveredCheck = coveredLayers ? (coveredLayers.has("interaction") || coveredLayers.has("transformation") || coveredLayers.has("part_b")) : false;
  if (!integrationLock && !immersionCoveredCheck && interactionCoveredCheck) {
    const prematureVoiceHit = VOICE_CHANNEL_PHRASES_PREMATURE.find((p) => lower.includes(p));
    if (prematureVoiceHit) {
      console.warn("[PREMATURE_VOICE_CHANNEL_BLOCKED]", { mode: currentMode, immersionRequired: true, triggeredPhrase: prematureVoiceHit });
      return {
        isValid: false,
        reason: `PREMATURE_VOICE_CHANNEL_BLOCKED: voice/message question ("${prematureVoiceHit}") asked before immersion phase`,
        correctedInstruction: "HARD REJECT — the process has not yet unfolded enough. Do NOT ask for voice, message or meaning. Ask an immersion question instead: 'Что начинает происходить, когда ты остаёшься рядом с этим?' or 'Как меняется твоё состояние?' or 'Что в этом становится сильнее?'. Questions like 'что бы это сказало', 'какое послание' are ONLY allowed after immersion phase is complete.",
      };
    }
  }

  // 4. Dream transformation layer validation
  const modeKey = (currentMode || "").toLowerCase();
  if (modeKey.includes("dream") && forcedNextLayer === "transformation") {
    const hasValidContent = TRANSFORMATION_VALID_KEYWORDS.some((kw) => lower.includes(kw));
    const hasInvalidContent = TRANSFORMATION_INVALID_PHRASES.some((phrase) => lower.includes(phrase));
    if (hasInvalidContent || !hasValidContent) {
      return {
        isValid: false,
        reason: `Transformation layer violated: jumped to meaning/message too early`,
        correctedInstruction: "Stay strictly in transformation layer. Ask only what happens in the user's exact action/experience. Do not introduce contact, touch, taste, sensory channels, message, meaning or interpretation unless the user explicitly introduced them.",
      };
    }
  }

  // 4a. Post-mapping focus gate
  if (dreamMappingComplete === true && !userSelectedFocus) {
    const deepeningPhrases = [
      "где ты ощущаешь", "в теле", "что хочет двигаться", "если бы это стало образом",
      "что за движение", "что ты чувствуешь", "голос", "послание",
      "давай исследуем", "тогда давай", "остановимся на", "посмотрим на",
    ];
    for (const phrase of deepeningPhrases) {
      if (lower.includes(phrase)) {
        console.warn(`[NARROWING_BLOCKED] reason: deepening_before_focus_selection triggered_phrase: "${phrase}"`);
        return {
          isValid: false,
          reason: `Focus gate violated: deepening or narrowing question asked before user identified highest-energy element ("${phrase}")`,
          correctedInstruction: "Do NOT deepen into any element yet. Reflect ALL secondary elements neutrally, then ask an energy-selection question: 'Что из этого цепляет тебя сильнее всего?' or 'Где больше энергии?' Wait for the user to identify the most charged element before proceeding.",
        };
      }
    }

    const integrationIntrusionPhrases = [
      "насколько это есть в твоей жизни", "насколько это состояние",
      "где этого не хватает", "где сейчас его не хватает",
      "как это связано с реальной жизнью", "как могла бы измениться",
      "что стало бы по-другому", "в реальной жизни", "в твоей жизни",
      "где в жизни это", "как это откликается в жизни",
    ];
    for (const phrase of integrationIntrusionPhrases) {
      if (lower.includes(phrase)) {
        console.warn(`[PROCESS_STAGE_LOCK] primaryCompleted: true secondaryCompleted: true energySelectionCompleted: false blocked_phrase: "${phrase}"`);
        return {
          isValid: false,
          reason: `Integration intrusion BLOCKED: life-integration question asked before focus selection and exploration ("${phrase}")`,
          correctedInstruction: "HARD REJECT — integration layer is NOT available yet. User has not selected an energy focus. Reflect ALL secondary elements neutrally (list them), then ask energy-selection: 'Что из этого цепляет тебя сильнее всего?' Do NOT ask about life, future, or real-world connection yet.",
        };
      }
    }
  }

  // 4b-pre. Closure validation: reject continued deepening after completion signal
  if (validationContext?.completionDetected) {
    const deepeningAfterClosure = [
      "что начинает происходить дальше", "что происходит дальше", "что дальше",
      "что ещё", "что глубже", "что под этим", "давай глубже", "пойдём глубже",
      "что начинает разворачиваться", "что ещё хочет проявиться", "куда это ведёт",
      "если ты остаёшься в этом ощущении", "если оставаться в этом состоянии",
      "если оставаться в этом ощущении", "если ты остаёшься в этом состоянии",
      "давай исследуем", "тогда давай исследуем", "остановимся на", "посмотрим на",
      "что за движение", "если бы это стало образом",
      "вернёмся к", "давай вернёмся",
      "что ты чувствуешь теперь", "что сейчас происходит в теле",
      "какой образ появляется", "что хочет сказать",
      "что говорит та часть", "что хочет та часть",
    ];
    for (const phrase of deepeningAfterClosure) {
      if (lower.includes(phrase)) {
        console.warn(`[CLOSURE_QUESTION_BLOCKED] matchedForbiddenPhrase: "${phrase}"`);
        return {
          isValid: false,
          reason: `Deepening after closure BLOCKED: assistant continued excavation after completion state ("${phrase}")`,
          correctedInstruction: "CLOSURE DETECTED. Do NOT ask another exploratory question or open new layers. Reflect the completed journey arc using the user's exact words, acknowledge the shift, then ask at most ONE of these gentle closing questions: 'Что тебе хочется взять с собой из этой сессии?' / 'Что важно сохранить?' / 'С чем тебе хочется выйти?'.",
        };
      }
    }
  }

  // 4b. Invented emotion check
  const INVENTED_EMOTIONS = ["тревожит", "пугает", "вдохновляет", "беспокоит тебя", "радует тебя", "злит тебя", "пугает тебя"];
  for (const emo of INVENTED_EMOTIONS) {
    if (lower.includes(emo)) {
      const userMentioned = conversationHistory
        .filter((m) => m.role === "user")
        .some((m) => m.content.toLowerCase().includes(emo));
      if (!userMentioned) {
        return {
          isValid: false,
          reason: `Invented emotion: "${emo}" attributed to user but never said by them`,
          correctedInstruction: `Remove "${emo}" — the user never expressed this emotion. Reflect only what the user explicitly said. Do not project emotional tone.`,
        };
      }
    }
  }

  // 4d. Channel contamination — HARD BLOCK
  const SENSORY_CHANNELS = [
    {
      name: "taste",
      responsePhrases: ["вкус", "какой вкус", "попробуй", "пробуешь", "пробовать"],
      userSignals: ["вкус", "пробу", "съел", "ем ", "попробова", "ест ", "пробовала", "пробовал", "попробовала"],
    },
    {
      name: "smell",
      responsePhrases: ["запах", "нюха", "аромат"],
      userSignals: ["запах", "нюха", "пахнет", "аромат"],
    },
    {
      name: "texture",
      responsePhrases: ["текстур", "на ощупь", "шершав", "гладк"],
      userSignals: ["текстур", "на ощупь", "шершав", "гладк"],
    },
    {
      name: "temperature",
      responsePhrases: ["температур", "горяч", "прохладн", "холодн"],
      userSignals: ["температур", "тепло", "холодн", "горяч", "прохладн"],
    },
    {
      name: "contact",
      responsePhrases: ["в контакт", "при контакт", "момент контакт", "при касани", "прикосновени"],
      userSignals: ["контакт", "дотронул", "касани", "прикосновени", "трогаю", "касаюсь", "дотронулась", "дотронулся"],
    },
    {
      name: "color",
      responsePhrases: ["что за цвет", "какой цвет", "цвет появля"],
      userSignals: ["цвет", "краска", "оттенок"],
    },
  ];

  const sessionUserText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  for (const channel of SENSORY_CHANNELS) {
    const triggeredPhrase = channel.responsePhrases.find((p) => lower.includes(p));
    if (triggeredPhrase) {
      const hasUserSignal = channel.userSignals.some((sig) => sessionUserText.includes(sig));
      if (!hasUserSignal) {
        console.warn(
          `[CHANNEL_CONTAMINATION_BLOCKED] channel: "${channel.name}" source_phrase: "${triggeredPhrase}" response_rejected: true`
        );
        return {
          isValid: false,
          reason: `Channel contamination HARD BLOCK: introduced "${channel.name}" channel ("${triggeredPhrase}") but user NEVER mentioned this channel in this session`,
          correctedInstruction: `HARD REJECT — remove ALL references to ${channel.name} (${triggeredPhrase}). The user never introduced this sensory channel. Stay strictly with the user's own words.`,
        };
      }
    }
  }

  // 5. Anti-loop
  const lastAssistant = conversationHistory
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content.toLowerCase());

  const responseWords = new Set(lower.split(/\s+/).filter((w) => w.length > 5));
  for (const prev of lastAssistant) {
    const prevWords = new Set(prev.split(/\s+/).filter((w) => w.length > 5));
    const overlap = [...responseWords].filter((w) => prevWords.has(w));
    if (overlap.length >= 5) {
      return {
        isValid: false,
        reason: "Response too similar to a previous assistant message (loop detected)",
        correctedInstruction: "The previous question was already asked. Move to the next process layer. Do not repeat.",
      };
    }
  }

  // 6. Concrete noun check
  const concreteNouns = ["муж", "жена", "фрукт", "фрукты", "дерево", "камень", "вода", "огонь", "ребёнок", "мать", "отец"];
  const userMentioned = concreteNouns.filter((n) => lastUserMessage.toLowerCase().includes(n));
  if (userMentioned.length > 0 && lower.includes("этот образ")) {
    return {
      isValid: false,
      reason: `User used concrete noun "${userMentioned[0]}" but response uses generic "этот образ"`,
      correctedInstruction: `Use the user's concrete words. Do not say 'этот образ'. Use: ${userMentioned.join(", ")}.`,
    };
  }

  return { isValid: true, reason: "", correctedInstruction: "" };
}

function getSafeFallback(currentMode, forcedNextLayer, integrationLock, mappingStage, isMismatch, isDreamAlreadyTold) {
  const modeKey = (currentMode || "").toLowerCase();
  if (integrationLock) {
    if (modeKey.includes("conflict")) return SAFE_FALLBACKS.conflict_integration;
    return SAFE_FALLBACKS.integration;
  }
  if (isDreamAlreadyTold) return SAFE_FALLBACKS.awaiting_primary;
  if (isMismatch && mappingStage) {
    if (mappingStage.stage === "awaiting_dream") return SAFE_FALLBACKS.mismatch_dream;
    if (mappingStage.stage === "awaiting_primary") return SAFE_FALLBACKS.awaiting_primary;
    if (mappingStage.stage === "awaiting_secondary") return SAFE_FALLBACKS.awaiting_secondary;
  }
  if (mappingStage?.stage === "awaiting_dream") return SAFE_FALLBACKS.awaiting_dream;
  if (mappingStage?.stage === "awaiting_primary") return SAFE_FALLBACKS.awaiting_primary;
  if (mappingStage?.stage === "awaiting_secondary") return SAFE_FALLBACKS.awaiting_secondary;
  if (forcedNextLayer === "transformation") return SAFE_FALLBACKS.transformation;
  if (forcedNextLayer === "immersion") return SAFE_FALLBACKS.immersion;
  if (modeKey.includes("body")) return SAFE_FALLBACKS.body;
  if (modeKey.includes("conflict")) return SAFE_FALLBACKS.conflict;
  if (modeKey.includes("journal")) return SAFE_FALLBACKS.journaling;
  return SAFE_FALLBACKS.integration;
}

export async function getAIResponse(session, step, messages, userMessage) {
  const currentMode = session.mode_id || session.mode;

  const recent = messages.slice(-8).map((m) => ({
    ...m,
    content: m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content,
  }));
  const history = recent
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  const coveredLayers = detectCoveredLayers(messages);
  const isIntegrationStage = detectIntegrationStage(messages);
  const resistanceCount = detectResistanceCount(messages);
  const completionDetection = detectCompletionState(messages);

  if (resistanceCount >= 3) {
    console.warn("[EDGE_LIMIT_REACHED]", { resistanceCount, processStopped: true, closureStarted: true });
  }

  const edgeLimitInstruction = resistanceCount >= 3
    ? `\n\n⚠️ EDGE LIMIT REACHED (${resistanceCount} resistance signals detected)\n` +
      `STOP ALL DEEPENING. Do NOT ask immersion/amplification/exploration questions.\n` +
      `REQUIRED: Acknowledge the edge respectfully. Say one of:\n` +
      `'Похоже, сейчас это место становится слишком трудным для дальнейшего углубления.' / \n` +
      `'Давай не будем тащить процесс через силу.' / \n` +
      `'Похоже, часть тебя пока не готова двигаться дальше — и это тоже важно.'\n` +
      `Then ask ONLY ONE memory-knot question:\n` +
      `'Что для тебя было самым важным в этой сессии?' or 'Какой инсайт тебе хочется сохранить?' or 'Что сейчас кажется самым ценным?'`
    : "";

  const mappingStage = detectProcessMappingStage(messages, currentMode);
  const mappingStageComplete = mappingStage.stage === "complete";
  const isDreamMode = (currentMode || "").toLowerCase().includes("dream");

  const dreamProcessMap = isDreamMode ? buildDreamProcessMap(messages) : null;
  const dreamMapFilledCount = dreamProcessMap ? countMapFields(dreamProcessMap) : 0;
  const dreamMappingComplete = mappingStageComplete;

  const isMismatch = detectMismatch(userMessage);
  const isDreamAlreadyTold = isDreamMode && detectDreamAlreadyTold(userMessage);
  const isMapStatusQuery = detectMapStatusQuery(userMessage);

  const needsMapping = !mappingStageComplete && !isIntegrationStage;

  const forcedNext = isIntegrationStage
    ? null
    : needsMapping
    ? null
    : getForcedNextLayer(currentMode, coveredLayers);
  const isLooping = detectLoopInLastExchanges(messages);

  const layerStatus = coveredLayers.size > 0
    ? `\n\n━━━ УЖЕ ПРОЙДЕННЫЕ СЛОИ (НЕ возвращайся к ним) ━━━\n${[...coveredLayers].map((l) => `✓ ${l}`).join("\n")}`
    : "";

  const modeKey = getModeKey(currentMode);
  const PRIMARY_QUESTIONS = {
    dream:      "Что из этого сна больше всего откликается с твоей реальной жизнью, привычными чувствами или знакомыми ситуациями?",
    body:       "Как ты обычно объясняешь это ощущение? Что в нём для тебя понятно, знакомо или связано с твоей обычной жизнью?",
    conflict:   "Какая из этих сторон для тебя более привычная, знакомая или ближе к тому, как ты обычно себя ведёшь?",
    journaling: "Что в этой ситуации для тебя уже понятно, знакомо или похоже на твой обычный способ реагировать?",
  };
  const SECONDARY_QUESTIONS = {
    dream:      "А что в этом сне кажется тебе самым странным, новым, непривычным, заряженным или совсем не похожим на тебя?",
    body:       "А что в этом телесном ощущении странное, необычное, непонятное, неожиданное или как будто не совсем твоё?",
    conflict:   "Какая сторона более новая, непривычная, труднее принимается или вызывает больше напряжения?",
    journaling: "А что здесь кажется новым, странным, живым, тревожащим, непривычным или пока не до конца понятным?",
  };

  let mappingStageInstruction = "";

  if (isDreamAlreadyTold) {
    const priorUserMessages = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" | ");
    const dreamSummaryHint = priorUserMessages.substring(0, 400);
    mappingStageInstruction = `\n\n🟠 ПЕТЛЯ DREAM INVITE — ПОЛЬЗОВАТЕЛЬ УЖЕ ДАЛ МАТЕРИАЛ\n` +
      `Пользователь указал, что уже рассказала сновидение / тему сна.\n` +
      `ЗАПРЕЩЕНО: повторять вопрос «Расскажи мне свой сон...»\n` +
      `ОБЯЗАТЕЛЬНО:\n` +
      `1. Признай одним предложением, перечислив КОНКРЕТНО что было сказано:\n` +
      `«Да, ты уже дала материал: [перечисли точные образы/темы из слов пользователя].»\n` +
      `2. Немедленно задай вопрос первичного процесса:\n` +
      `«${PRIMARY_QUESTIONS[modeKey] || "Что из этого больше всего откликается с твоей реальной жизнью, привычными чувствами или знакомыми ситуациями?"}»\n` +
      `\nМатериал пользователя (используй точные слова отсюда):\n"${dreamSummaryHint}"\n` +
      `ЗАПРЕЩЕНО: спрашивать про тело, образы, смысл до ответа на первичный вопрос.\n` +
      `ЗАПРЕЩЕНО: повторять «расскажи» или «расскажи мне свой сон».`;
  }
  else if (isMismatch) {
    const rollbackStage = mappingStage.stage;
    let rollbackInstruction = "";
    if (rollbackStage === "awaiting_dream") {
      rollbackInstruction = `СТАДИЯ: awaiting_dream. Пользователь ещё не рассказал сон.\n` +
        `Ты должен ответить: «Ты права, я перескочил вперёд. Сначала важно услышать сам сон целиком. Расскажи его так, как он тебе запомнился.»\n` +
        `ЗАПРЕЩЕНО: продолжать с того места, где был. ЗАПРЕЩЕНО: упоминать вкус, контакт, образы, тело.`;
    } else if (rollbackStage === "awaiting_primary") {
      rollbackInstruction = `СТАДИЯ: awaiting_primary. Сон рассказан, но первичный процесс ещё не определён.\n` +
        `Ты должен ответить: «Ты права, я поспешил. Давай сначала разберёмся с тем, что в этом сне для тебя знакомо.»\n` +
        `Затем задай: «${PRIMARY_QUESTIONS[modeKey]}»`;
    } else if (rollbackStage === "awaiting_secondary") {
      rollbackInstruction = `СТАДИЯ: awaiting_secondary. Первичный определён, но вторичный ещё не определён.\n` +
        `Ты должен ответить: «Ты права, я забежал вперёд. Мы ещё не разобрали, что здесь новое или непривычное.»\n` +
        `Затем задай: «${SECONDARY_QUESTIONS[modeKey]}»`;
    }
    if (rollbackInstruction) {
      mappingStageInstruction = `\n\n🔴 МИСМАТЧ — ПОЛЬЗОВАТЕЛЬ УКАЗАЛ, ЧТО АИ ОШИБСЯ\n` +
        `${rollbackInstruction}\n` +
        `ЗАПРЕЩЕНО: продолжать предыдущее направление. ЗАПРЕЩЕНО: задавать вопросы о теле, образах, смысле.\n` +
        `ОБЯЗАТЕЛЬНО: сначала признай ошибку одним предложением, затем задай нужный вопрос.`;
    }
  }
  else if (!isDreamAlreadyTold && isMapStatusQuery && !mappingStageComplete) {
    const knownPrimary = mappingStage.primary_answer
      ? `Первичный процесс: «${mappingStage.primary_answer.substring(0, 80)}».`
      : "Первичный процесс пока не определён.";
    const knownSecondary = mappingStage.secondary_answer
      ? `Вторичный процесс: «${mappingStage.secondary_answer.substring(0, 80)}».`
      : "Вторичный процесс пока не определён.";
    const nextQ = mappingStage.stage === "awaiting_primary" || mappingStage.stage === "awaiting_dream"
      ? PRIMARY_QUESTIONS[modeKey]
      : SECONDARY_QUESTIONS[modeKey];
    mappingStageInstruction = `\n\n🔵 ПОЛЬЗОВАТЕЛЬ СПРАШИВАЕТ О СОСТОЯНИИ КАРТЫ — ОТВЕТЬ ПРЯМО\n` +
      `Скажи: «Пока только предварительно.\n${knownPrimary}\n${knownSecondary}\n` +
      `Чтобы завершить карту, мне нужен ответ на один вопрос:»\n` +
      `Затем задай: «${nextQ}»\n` +
      `ЗАПРЕЩЕНО: переадресовывать, уходить в коучинг, задавать вопросы о теле или образах.`;
  }
  else if (!isDreamAlreadyTold && !mappingStageComplete && !isIntegrationStage && modeKey) {
    if (mappingStage.stage === "awaiting_dream") {
      mappingStageInstruction = `\n\n🔴 СТАДИЯ: ОЖИДАНИЕ СНОВИДЕНИЯ\n` +
        `Пользователь ещё НЕ рассказал свой сон. Задай ТОЛЬКО:\n` +
        `«Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?»\n\n` +
        `АБСОЛЮТНО ЗАПРЕЩЕНО до получения рассказа о сне:\n` +
        `✗ Вопросы про первичный/вторичный процесс\n` +
        `✗ Вопросы про тело, ощущения, импульсы\n` +
        `✗ Вопросы про образы или символы\n` +
        `✗ Любые уточнения, рефлексии, интерпретации\n` +
        `✗ Фразы типа «что в этом сне тебе кажется знакомым» — ЗАПРЕЩЕНО до рассказа сна.`;
    } else if (mappingStage.stage === "awaiting_primary") {
      mappingStageInstruction = `\n\n🔴 СТАДИЯ: ПЕРВИЧНЫЙ ПРОЦЕСС\n` +
        `Задай ИМЕННО ЭТОТ вопрос:\n` +
        `«${PRIMARY_QUESTIONS[modeKey]}»\n\n` +
        `ЗАПРЕЩЕНО до получения ответа:\n` +
        `✗ Вопрос про вторичный процесс\n` +
        `✗ Вопросы про тело, образы, смысл\n` +
        `✗ Любое исследование или углубление`;
    } else if (mappingStage.stage === "awaiting_secondary") {
      mappingStageInstruction = `\n\n🔴 СТАДИЯ: ВТОРИЧНЫЙ ПРОЦЕСС\n` +
        `Первичный процесс определён (ответ: «${(mappingStage.primary_answer || "").substring(0, 100)}»).\n` +
        `Задай ОДИН отдельный вопрос:\n` +
        `«${SECONDARY_QUESTIONS[modeKey]}»\n\n` +
        `ЗАПРЕЩЕНО до получения ответа:\n` +
        `✗ Переход к телу, образам, смыслу\n` +
        `✗ Любое исследование или углубление`;
    }
  }

  const secondaryAnswerIndex = messages.findLastIndex((m) => m.role === "user" && mappingStage.secondary_answer && m.content.includes(mappingStage.secondary_answer.substring(0, 30)));
  const messagesAfterSecondary = secondaryAnswerIndex >= 0 ? messages.slice(secondaryAnswerIndex + 1) : [];
  const assistantReflectedMap = messagesAfterSecondary.some((m) => m.role === "assistant" && (m.content.includes("знакомое") || m.content.includes("непривычное") || m.content.includes("на что тебе сейчас хочется")));
  const userSelectedFocus = assistantReflectedMap && messagesAfterSecondary.some((m) => m.role === "user");

  const mappingCompleteContext = mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer
    ? !assistantReflectedMap
      ? `\n\n✅ КАРТА ЗАВЕРШЕНА — СЛЕДУЮЩИЙ ШАГ: ОТРАЖЕНИЕ ВТОРИЧНОГО ПОЛЯ + ВЫБОР ЭНЕРГИИ\n` +
        `Отрази ВСЕ вторичные элементы нейтрально (используй точные слова пользователя).\n` +
        `Затем задай вопрос выбора энергии.\n\n` +
        `Шаблон ответа:\n` +
        `«Похоже, здесь появляется сразу несколько непривычных элементов:\n\n` +
        `— [элемент 1 из слов пользователя]\n` +
        `— [элемент 2 из слов пользователя]\n` +
        `— [элемент 3 из слов пользователя]\n\n` +
        `И у каждого из них может быть своё качество или энергия.\n\n` +
        `Если прислушаться внимательнее —\n` +
        `что из этого сейчас кажется тебе самым необычным, заряженным, удивляющим или притягивающим?»\n\n` +
        `АБСОЛЮТНО ЗАПРЕЩЕНО:\n` +
        `✗ Выбирать один вторичный элемент как «главный»\n` +
        `✗ Начинать исследование любого элемента без ответа пользователя\n` +
        `✗ Приписывать эмоцию, которую пользователь не называл\n` +
        `✗ Переходить к телу, движению или образу до выбора фокуса`
      : !userSelectedFocus
      ? `\n\n✅ КАРТА ОТРАЖЕНА — ОЖИДАНИЕ ВЫБОРА ЭНЕРГИИ\n` +
        `Пользователь ещё не указал, какой элемент наиболее заряженный.\n` +
        `Жди ответа. НЕ выбирай фокус сам. НЕ начинай исследование ни одного элемента.\n` +
        `Если нужно, переформулируй вопрос выбора энергии: «Что из этого цепляет сильнее всего?»`
      : `\n\n✅ ФОКУС ВЫБРАН ПОЛЬЗОВАТЕЛЕМ\n` +
        `— первичный процесс: «${mappingStage.primary_answer.substring(0, 100)}»\n` +
        `— вторичный процесс (поле): «${mappingStage.secondary_answer.substring(0, 100)}»\n` +
        `— активный фокус (selected_process_focus): последний явный выбор пользователя\n\n` +
        `Теперь исследуй ТОЛЬКО то, что пользователь назвал наиболее заряженным.\n` +
        `Начни с: «Тогда давай исследуем именно это — [точные слова пользователя]...»\n` +
        `Далее: следуй каналу, который уже активен в словах пользователя.`
    : "";

  const dreamMapContext = isDreamMode && dreamProcessMap && !mappingStageComplete && mappingStage.stage !== "awaiting_dream"
    ? `\n\n━━━ ТЕКУЩАЯ КАРТА ПРОЦЕССА (СОН) — СТАТУС ━━━
${formatProcessMapForPrompt(dreamProcessMap, dreamMapFilledCount)}

🔴 Первичный и вторичный процессы ещё не определены через отдельные уточняющие вопросы.
ЗАПРЕЩЕНО: переходить к телесному исследованию, атмосфере сна или любым слоям 1–7.
ЗАПРЕЩЕНО: спрашивать «где ты ощущаешь это в теле?» или любые соматические вопросы.`
    : "";

  const primaryThread = detectPrimaryProcessThread(messages);
  const hasSecondaryMaterial = primaryThread && detectSecondaryMaterialInLatestMessage(userMessage);
  const primaryThreadGuard = primaryThread
    ? `\n\n🔵 ЦЕНТРАЛЬНЫЙ ПРОЦЕСС СЕССИИ: "${primaryThread}"\n` +
      `Этот процесс уже глубоко раскрылся в разговоре. Он является ПЕРВИЧНЫМ.\n` +
      (hasSecondaryMaterial
        ? `Пользователь только что выразил вторичный материал (тревогу, страх, сомнение).\n` +
          `НЕ переключай фасилитацию на этот вторичный материал.\n` +
          `ВМЕСТО ЭТОГО: исследуй, как первичное состояние («${primaryThread}») трансформирует или содержит вторичное.\n` +
          `Примеры:\n` +
          `• «Как меняется эта тревога, когда ты соединяешься с ощущением ${primaryThread}?»\n` +
          `• «Что становится возможным, когда ты опираешься на это состояние ${primaryThread}?»\n` +
          `ЗАПРЕЩЕНО: «Что хочет сделать тревога?», «Где в теле страх?» — не исследуй вторичный материал как главный.\n`
        : `Каждый следующий вопрос должен опираться на это состояние и углублять его.\n`)
    : "";

  const isConflictMode = (currentMode || "").toLowerCase().includes("conflict");
  const integrationLock = isIntegrationStage
    ? `\n\n🔒 БЛОКИРОВКА — СТАДИЯ ИНТЕГРАЦИИ АКТИВНА\n` +
      `Пользователь уже выразил внутреннее изменение или сдвиг состояния.\n` +
      `ЗАПРЕЩЕНО: возвращаться к образу, метафоре, телу, взаимодействию, сну.\n` +
      `ЗАПРЕЩЕНО: спрашивать «каким бы это стало образом», «что происходит в теле», «что ты видишь».\n` +
      (isConflictMode
        ? `ЗАПРЕЩЕНО (режим КОНФЛИКТ): возвращаться к частям, вводить образы или метафоры.\n` +
          `ОБЯЗАТЕЛЬНО (режим КОНФЛИКТ): веди к решению и действию. Используй ТОЛЬКО эти вопросы:\n` +
          `• «Что в твоём решении начинает проясняться сейчас?»\n` +
          `• «Как это состояние влияет на твоё ощущение — оставаться или уходить?»\n` +
          `• «Что сейчас кажется более честным по отношению к себе?»\n` +
          `• «Какой маленький шаг ты могла бы сделать, не предавая себя?»\n`
        : `ОБЯЗАТЕЛЬНО: оставайся на уровне интеграции. Допустимы только:\n` +
          `1. Признание сдвига: «Похоже, здесь уже происходит внутреннее изменение.»\n` +
          `2. Вопрос о реальной жизни: «Насколько это состояние уже есть в твоей жизни, а где его пока не хватает?»\n` +
          `3. Вопрос о будущем: «Как могла бы измениться твоя жизнь, если бы ты жила из этого состояния?»\n` +
          `4. Завершение: отражение + инсайт + «Ты хочешь зафиксировать этот инсайт?»\n`) +
      `Используй конкретные слова пользователя.`
    : "";

  if (completionDetection.isComplete) {
    console.log("[CLOSURE_DETECTED]", { closureState: completionDetection.closureState, matchedSignal: completionDetection.matchedSignal, furtherDeepeningBlocked: true });
  }
  const closureInstruction = completionDetection.isComplete
    ? `\n\n🔚 ЗАВЕРШЕНИЕ ОБНАРУЖЕНО — сигнал: «${completionDetection.matchedSignal}». Отрази путь (начало→сейчас), признай сдвиг, задай МАКСИМУМ ОДИН мягкий закрывающий вопрос, затем завершай. ЗАПРЕЩЕНО: ещё один исследовательский вопрос, «что дальше?», повторное открытие материала.`
    : "";

  const forcedInstruction = !isIntegrationStage && !completionDetection.isComplete && mappingStageComplete && forcedNext && NEXT_LAYER_INSTRUCTIONS[forcedNext]
    ? `\n\n🔴 ОБЯЗАТЕЛЬНЫЙ СЛЕДУЮЩИЙ ШАГ: ${NEXT_LAYER_INSTRUCTIONS[forcedNext]}\n` +
      `НЕ задавай вопросы об уже пройденных слоях. Только этот шаг.\n` +
      (forcedNext === "transformation"
        ? `🚫 БЛОКИРОВКА: запрещено спрашивать «что хочет сказать», «что это значит», «что он показывает». Сейчас только шаг 4: что происходит в момент этого действия? Используй ТОЧНЫЕ слова пользователя.`
        : forcedNext === "immersion"
        ? `🚫 БЛОКИРОВКА: ЗАПРЕЩЕНО спрашивать «что бы это сказало?», «какое у этого послание?», «что это хочет сказать?». Сначала ИММЕРСИЯ — оставайся с опытом.`
        : "")
    : "";

  const loopWarning = isLooping
    ? `\n\n⚠️ ПЕТЛЯ ОБНАРУЖЕНА: немедленно переходи к следующему слою. Скажи: «Похоже, мы хорошо изучили этот уровень. Давай двинемся глубже.»`
    : "";

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

  const buildPrompt = (extraInstruction = "") =>
    `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}${layerStatus}${dreamMapContext}${mappingStageInstruction}${mappingCompleteContext}${primaryThreadGuard}${integrationLock}${closureInstruction}${forcedInstruction}${loopWarning}${edgeLimitInstruction}${extraInstruction}

Режим: ${currentMode}

━━━ ИСТОРИЯ РАЗГОВОРА (все уже отвеченные слои — НЕ повторяй их) ━━━
${history}

━━━ ПОСЛЕДНЕЕ СООБЩЕНИЕ ЧЕЛОВЕКА ━━━
${userMessage}

━━━ ТВОЯ ЗАДАЧА ━━━
1. Сверься со списком УЖЕ ПРОЙДЕННЫХ СЛОЁВ выше.
2. Найди первый слой, которого нет в списке.
3. Напиши 1 отражение, используя конкретные слова человека (не «этот образ», не «ты ощущаешь»).
4. Задай 1 точный вопрос к следующему слою, строя его на том, что уже сказано.
Строго 2–3 предложения. Никаких повторов. Никаких шаблонов. Движение вперёд.`;

  const fullPrompt = buildPrompt();
  const estimatedTokens = Math.ceil(fullPrompt.length / 4);

  console.log("[AI_RUNTIME] Pre-call diagnostics:", {
    mode: currentMode,
    currentStep: step?.step_number ?? "?",
    mappingStage: mappingStage.stage,
    isMismatch,
    isDreamAlreadyTold,
    isMapStatusQuery,
    estimatedTokens,
    coveredLayers: [...coveredLayers],
    forcedNextLayer: forcedNext,
    integrationLock: isIntegrationStage,
    closureDetected: completionDetection.isComplete,
    closureSignal: completionDetection.matchedSignal || null,
    isLooping,
    primaryThread,
    hasSecondaryMaterial,
  });

  console.log("[PROCESS_STAGE_LOCK]", {
    primaryCompleted: !!mappingStage.primary_answer,
    secondaryCompleted: !!mappingStage.secondary_answer,
    energySelectionCompleted: userSelectedFocus,
    mappingStageComplete,
    assistantReflectedMap,
  });

  if (estimatedTokens > 6000) {
    console.warn("[AI_RUNTIME] Prompt too large (" + estimatedTokens + " est. tokens). Trimming history to 4 messages.");
    const trimmed = messages.slice(-4).map((m) => ({
      ...m,
      content: m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content,
    }));
    const trimmedHistory = trimmed
      .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
      .join("\n");
    const trimmedPrompt = `${SYSTEM_PROMPT}${stepContext}${layerStatus}${integrationLock}${forcedInstruction}${loopWarning}

Режим: ${currentMode}

━━━ ИСТОРИЯ РАЗГОВОРА ━━━
${trimmedHistory}

━━━ ПОСЛЕДНЕЕ СООБЩЕНИЕ ЧЕЛОВЕКА ━━━
${userMessage}

Напиши 1 отражение и 1 вопрос к следующему слою. Строго 2–3 предложения.`;
    try {
      const r = await base44.integrations.Core.InvokeLLM({ prompt: trimmedPrompt });
      return r || getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold);
    } catch (e) {
      console.error("[AI_RUNTIME] InvokeLLM FAILED (trimmed):", e?.message);
      throw e;
    }
  }

  const validationParams = {
    currentMode,
    forcedNextLayer: forcedNext,
    integrationLock: isIntegrationStage,
    conversationHistory: messages,
    lastUserMessage: userMessage,
    dreamMappingComplete,
    mappingStageValue: isDreamAlreadyTold ? "awaiting_primary" : mappingStage.stage,
    userSelectedFocus,
    completionDetected: completionDetection.isComplete,
    coveredLayers,
    resistanceCount,
  };

  // ── Pass 1: initial generation ────────────────────────────────────────────
  let firstResponse;
  try {
    console.log("[AI_RUNTIME] Calling InvokeLLM (pass 1), est tokens:", estimatedTokens);
    firstResponse = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    console.log("[AI_RUNTIME] InvokeLLM pass 1 success, response length:", firstResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 1):", e?.message, String(e));
    const minimalPrompt = `Ты Process Work guide. Задавай один мягкий вопрос.\n\nПоследнее сообщение пользователя: ${userMessage}`;
    try {
      const safeResponse = await base44.integrations.Core.InvokeLLM({ prompt: minimalPrompt });
      return safeResponse || getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold);
    } catch (e2) {
      console.error("[AI_RUNTIME] Safe-mode retry ALSO FAILED:", e2?.message);
      throw e;
    }
  }

  const firstValidation = validateAssistantResponse({ responseText: firstResponse, ...validationParams });

  if (firstValidation.isValid) {
    return firstResponse;
  }

  console.warn("[AI_RUNTIME] Pass 1 failed validation:", firstValidation.reason);

  const retryInstruction = `\n\n🚨 ВАЖНО: предыдущий ответ был ОТКЛОНЁН. Причина: ${firstValidation.reason}. ${firstValidation.correctedInstruction}`;
  let secondResponse;
  try {
    secondResponse = await base44.integrations.Core.InvokeLLM({ prompt: buildPrompt(retryInstruction) });
    console.log("[AI_RUNTIME] InvokeLLM pass 2 success, response length:", secondResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 2):", e?.message);
    return getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold);
  }

  const secondValidation = validateAssistantResponse({ responseText: secondResponse, ...validationParams });

  if (secondValidation.isValid) {
    console.info("[AI_RUNTIME] Pass 2 passed validation.");
    return secondResponse;
  }

  console.warn("[AI_RUNTIME] Pass 2 also failed validation:", secondValidation.reason);
  const fallback = getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold);
  console.info("[AI_RUNTIME] Using safe fallback:", fallback);
  return fallback;
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