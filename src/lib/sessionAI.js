import { base44 } from "@/api/base44Client";
import { COMPLETION_SIGNALS, detectCompletionState } from "@/lib/sessionSignals";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import {
  extractStageAnswersFromUserMessages,
  detectUserAlreadyAnswered,
} from "@/lib/stageExtraction";
import {
  buildSessionState,
  detectFocusChange,
  detectLastInterventionType,
} from "@/lib/stageLocks";
import {
  validateAssistantResponse,
  getSafeFallback,
} from "@/lib/sessionValidation";

// Crisis detection moved to ./crisis (kept re-exported for existing imports).
export {
  CRISIS_MESSAGE,
  getCrisisMessage,
  checkCrisis,
  checkLowRisk,
} from "./crisis";

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

  // Resilient fallback: the mode HAS steps, but none match the requested number
  // (e.g. session.current_step advanced past the last step, or a gap in numbering).
  // Never strand the user with "Step not found" — fall back to the closest available step.
  const sorted = [...forMode].sort((a, b) => a._stepNum - b._stepNum);
  const nextHigher = sorted.find((s) => s._stepNum >= stepNum);
  const fallback = nextHigher || sorted[0];
  if (fallback) {
    console.warn(
      `[FETCH_STEP_DEBUG] No exact match for step ${stepNum} — falling back to step "${fallback._stepKey || fallback._stepNum}" ` +
      `(mode="${modeIdClean}", availableKeys=[${availableKeys.join(", ")}])`
    );
    return fallback;
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

// Beginner confusion signals — when present, offer simple choices instead of deepening.
const BEGINNER_CONFUSION_SIGNALS = [
  "не знаю", "сложно сказать", "не понимаю", "непонятно",
  "затрудняюсь", "не чувствую", "не могу описать", "трудно сказать",
];

function detectBeginnerConfusion(userMessage) {
  const lower = userMessage.toLowerCase().trim();
  return BEGINNER_CONFUSION_SIGNALS.some((sig) => lower.includes(sig));
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

// ─── Initial material detection (body / conflict / journaling) ───────────────
const BODY_MATERIAL_SIGNALS = [
  "боль", "напряжение", "симптом", "ощущение", "тело", "усталость",
  "тяжесть", "сжатие", "давление", "спазм",
  "migraine", "migraña", "dolor", "tensión", "cuerpo", "cansancio", "síntoma",
];

const CONFLICT_MATERIAL_SIGNALS = [
  "конфликт", "с одной стороны", "с другой стороны", "часть меня", "спор",
  "не могу решить", "выбор", "уйти", "остаться",
  "quiero", "no quiero", "conflicto", "por una parte", "por otra parte",
  "una parte de mí", "decisión",
];

const JOURNALING_MATERIAL_SIGNALS = [
  "хочу понять", "ситуация", "чувство", "вопрос", "тема", "мысль",
  "не знаю что делать",
  "quiero entender", "situación", "emoción", "pregunta", "tema", "pensamiento",
];

function detectInitialMaterial(messages, modeKey) {
  const userMsgs = messages.filter((m) => m.role === "user");
  const combined = userMsgs.map((m) => m.content.toLowerCase()).join(" ");

  if (modeKey === "body") {
    return BODY_MATERIAL_SIGNALS.some((s) => combined.includes(s));
  }
  if (modeKey === "conflict") {
    return CONFLICT_MATERIAL_SIGNALS.some((s) => combined.includes(s));
  }
  if (modeKey === "journaling") {
    const hasSignal = JOURNALING_MATERIAL_SIGNALS.some((s) => combined.includes(s));
    const hasSubstance = userMsgs.some((m) => m.content.trim().length > 20);
    return hasSignal || hasSubstance;
  }
  return true;
}

const INITIAL_MATERIAL_STAGE = {
  body: "awaiting_body_signal",
  conflict: "awaiting_conflict_material",
  journaling: "awaiting_journaling_topic",
};

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

  // Initial material collection for body / conflict / journaling
  if (!isDream && INITIAL_MATERIAL_STAGE[modeKey]) {
    const hasMaterial = detectInitialMaterial(messages, modeKey);
    if (!hasMaterial) {
      return { stage: INITIAL_MATERIAL_STAGE[modeKey], primary_answer: null, secondary_answer: null, dream_shared: true };
    }
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

  // ── Merge with semantic extraction (user may have answered stages early) ──
  const semantic = extractStageAnswersFromUserMessages(messages, modeKey, detectInitialMaterial);
  primary_answer = primary_answer || semantic.primary_answer;
  secondary_answer = secondary_answer || semantic.secondary_answer;
  const selected_focus = semantic.selected_focus || null;
  const integration_material = semantic.integration_material || null;
  const closure_signal = semantic.closure_signal || null;
  const initial_material = semantic.initial_material || null;

  // Focus lock + exploration detection (all modes)
  const current_process_target = detectCurrentProcessTarget(messages);
  const focus_locked = !!selected_focus || !!current_process_target;
  const exploration_active = focus_locked || detectUnfoldingSignals(messages);

  const base = {
    primary_answer, secondary_answer, selected_focus, integration_material,
    closure_signal, initial_material, dream_shared, focus_locked, exploration_active,
    current_process_target,
  };

  if (!primary_answer) {
    return { stage: "awaiting_primary", ...base };
  }
  if (!secondary_answer) {
    return { stage: "awaiting_secondary", ...base };
  }
  return { stage: "complete", ...base };
}

// Unfolding / exploration signals — once present, exploration is active.
const UNFOLDING_SIGNALS = [
  // RU
  "расцветает", "расширяется", "растёт", "растет", "становится", "много света",
  "солнечный свет", "радость", "изобилие", "широта", "свобода", "рост", "энергия",
  "меняется", "развивается", "разворачивается", "раскрывается",
  // ES
  "florece", "se expande", "crece", "se desarrolla", "luz", "alegría",
  "abundancia", "libertad", "energía", "cambia", "se abre",
];

function detectUnfoldingSignals(messages) {
  const combined = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return UNFOLDING_SIGNALS.some((s) => combined.includes(s));
}

// Extract a short "current_process_target" — the concrete image/process the user
// is actively unfolding. Looks at recent user messages for unfolding language and
// returns the surrounding sentence (capped).
function detectCurrentProcessTarget(messages) {
  const userMsgs = messages.filter((m) => m.role === "user");
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const text = userMsgs[i].content;
    const lower = text.toLowerCase();
    const hit = UNFOLDING_SIGNALS.find((s) => lower.includes(s));
    if (hit) {
      const sentences = text.split(/(?<=[.!?\n])\s+/);
      const target = sentences.find((s) => s.toLowerCase().includes(hit)) || text;
      return target.trim().slice(0, 160);
    }
  }
  return null;
}

// Stage rank — higher = later. Used to block backward regression.
export function getCurrentStageRank(mappingStage) {
  if (mappingStage.closure_signal) return 7;
  if (mappingStage.integration_material) return 6;
  if (mappingStage.exploration_active) return 5;
  if (mappingStage.focus_locked) return 5;
  if (mappingStage.primary_answer && mappingStage.secondary_answer) return 4;
  if (mappingStage.primary_answer) return 3;
  if (mappingStage.dream_shared || mappingStage.initial_material) return 2;
  return 1;
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

// Layers that represent mapping / focus-selection — never allowed once focus is locked.
const BACKWARD_LAYERS = new Set(["process_mapping", "atmosphere", "dream_image"]);

function getForcedNextLayer(modeId, coveredLayers, mappingStage) {
  const modeKey = modeId?.toLowerCase().replace(/[^a-z]/g, "") || "";
  const chainKey = Object.keys(FORWARD_CHAIN).find((k) => modeKey.includes(k)) || null;
  if (!chainKey) return null;

  const focusLocked = !!(mappingStage?.focus_locked || mappingStage?.exploration_active);

  const chain = FORWARD_CHAIN[chainKey];
  let forcedNext = null;
  for (const [layer, next] of Object.entries(chain)) {
    if (coveredLayers.has(layer)) {
      forcedNext = next;
    }
  }
  if (forcedNext && coveredLayers.has(forcedNext)) return null;

  // Once focus is locked, never force a backward mapping/image/atmosphere layer.
  if (focusLocked && forcedNext && BACKWARD_LAYERS.has(forcedNext)) {
    return coveredLayers.has("immersion") ? "message" : "immersion";
  }
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

// ─── Response validation (extracted to lib/sessionValidation.js) ─────────────

// validateAssistantResponse + getSafeFallback + SAFE_FALLBACKS live in lib/sessionValidation.js

// ─── ModeStep as primary guide ───────────────────────────────────────────────
function buildModeStepInstruction(step, language) {
  if (!step || !step.question) return "";
  const isEs = language === "es";
  const langLine = isEs
    ? "Если language = es — переведи/адаптируй вопрос на естественный испанский, СОХРАНИВ процессуальную функцию шага.\n"
    : "";

  return (
    `\n\n━━━ ОБЯЗАТЕЛЬНЫЙ ТЕКУЩИЙ ШАГ ИЗ MODE_STEPS ━━━\n` +
    `Сформулируй следующий вопрос на основе ЭТОГО шага. Не повторяй предыдущие вопросы.\n` +
    `Можно адаптировать формулировку под слова пользователя, но нельзя игнорировать цель и направление шага.\n\n` +
    `• step_number: ${step.step_number ?? "?"}\n` +
    `• step_key: ${step.step_key || "—"}\n` +
    `• goal (цель): ${step.goal || "—"}\n` +
    `• question (направление): ${step.question || "—"}\n` +
    (step.facilitator_hint ? `• facilitator_hint: ${step.facilitator_hint}\n` : "") +
    (step.response_type ? `• expected_response_type: ${step.response_type}\n` : "") +
    (step.related_term_ids ? `• related_term_ids: ${step.related_term_ids}\n` : "") +
    `\nЗАДАЧА: задай ровно ОДИН вопрос, который продвигает именно этот шаг.\n` +
    `Не задавай общий вопрос про карту/тело/диалог, если этот шаг прямо этого не требует.\n` +
    `Используй точные слова пользователя.\n` +
    langLine
  );
}

function buildLanguageOverride(language) {
  const lang = language === "es" ? "es" : "ru";
  if (lang === "es") {
    return `\n\n━━━ LANGUAGE OVERRIDE ━━━\n` +
      `language = es → Responde ÚNICAMENTE en español natural y cálido.\n` +
      `Nunca mezcles idiomas. Nunca respondas en ruso ni en inglés (salvo que el usuario lo pida explícitamente).\n` +
      `Mantén EXACTAMENTE la misma estructura de Process Work (proceso primario, proceso secundario, selección de energía, exploración, integración, cierre). Solo cambia el idioma de comunicación, NUNCA la lógica de la sesión.\n` +
      `Trata al usuario de "tú" (informal, cálido).`;
  }
  return `\n\n━━━ LANGUAGE OVERRIDE ━━━\n` +
    `language = ru → Отвечай ТОЛЬКО на русском языке.\n` +
    `Никогда не смешивай языки. Никогда не отвечай на испанском или английском (если пользователь явно не попросит).`;
}

export async function getAIResponse(session, step, messages, userMessage, language = "ru", memoriesBlock = "") {
  const currentMode = session.mode_id || session.mode;
  const languageOverride = buildLanguageOverride(language);

  const recent = messages.slice(-8).map((m) => ({
    ...m,
    content: m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content,
  }));
  const history = recent
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  const hasValidStep = !!(step && step.question);
  console.log("[MODESTEP_VALIDITY]", {
    hasValidStep,
    step_key: step?.step_key,
    step_number: step?.step_number,
  });

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

  const isBeginnerConfused = detectBeginnerConfusion(userMessage);
  const isBodyModeEarly = (currentMode || "").toLowerCase().includes("body");
  if (isBeginnerConfused) {
    console.log("[BEGINNER_CHOICES_OFFERED]", { mode: currentMode, userMessage: userMessage.slice(0, 60) });
  }
  const beginnerChoicesInstruction = isBeginnerConfused
    ? `\n\n🟢 ПОЛЬЗОВАТЕЛЬ ЗАТРУДНЯЕТСЯ ОТВЕТИТЬ — НЕ УГЛУБЛЯЙ\n` +
      `Пользователь сказал, что не знает / сложно сказать / не понимает. Не углубляйся и не дави.\n` +
      `Тепло предложи варианты на выбор (используй короткий список):\n` +
      (isBodyModeEarly
        ? `«Можно выбрать из вариантов:\n— напряжение\n— давление\n— тепло\n— холод\n— пустота\n— движение\n— пульсация\n— или что-то другое?»`
        : `«Это больше похоже на:\n— страх\n— злость\n— усталость\n— сопротивление\n— интерес\n— облегчение\n— или что-то своё?»`) +
      `\nТолько в этом случае список вариантов разрешён.`
    : "";

  const mappingStage = detectProcessMappingStage(messages, currentMode);
  const mappingStageComplete = mappingStage.stage === "complete";
  const isDreamMode = (currentMode || "").toLowerCase().includes("dream");
  const modeKeyEarly = getModeKey(currentMode);

  const dreamProcessMap = isDreamMode ? buildDreamProcessMap(messages) : null;
  const dreamMapFilledCount = dreamProcessMap ? countMapFields(dreamProcessMap) : 0;
  const dreamMappingComplete = mappingStageComplete;

  const isMismatch = detectMismatch(userMessage);
  const isDreamAlreadyTold = isDreamMode && detectDreamAlreadyTold(userMessage);
  const isMapStatusQuery = detectMapStatusQuery(userMessage);
  const userAlreadyAnswered = detectUserAlreadyAnswered(userMessage);

  if (userAlreadyAnswered) {
    const nextStage = mappingStage.stage;
    console.warn("[USER_ALREADY_ANSWERED_STAGE]", {
      mode: modeKeyEarly,
      detected_initial_material: !!extractStageAnswersFromUserMessages(messages, modeKeyEarly, detectInitialMaterial).initial_material,
      detected_primary: !!mappingStage.primary_answer,
      detected_secondary: !!mappingStage.secondary_answer,
      detected_focus: !!mappingStage.selected_focus,
      detected_integration: !!mappingStage.integration_material,
      detected_closure: !!mappingStage.closure_signal,
      next_stage: nextStage,
    });
  }

  const focusForAck = mappingStage.selected_focus || mappingStage.current_process_target;
  const alreadyAnsweredInstruction = userAlreadyAnswered
    ? `\n\n🟠 ПОЛЬЗОВАТЕЛЬ УКАЗАЛ, ЧТО УЖЕ ОТВЕТИЛ / НЕ ПОНЯЛ ВОПРОС\n` +
      `НЕ задавай тот же вопрос снова. Перечитай предыдущие сообщения и извлеки уже данный ответ.\n` +
      `Формат ответа (строго):\n` +
      (language === "es"
        ? `«Sí, ya lo señalaste: [краткое summary]. El foco ahora es ${focusForAck ? `«${String(focusForAck).substring(0, 120)}»` : "[selected_focus]"}. [один разворачивающий вопрос текущей стадии]»\n`
        : `«Да, ты уже это обозначила: [краткое summary]. Фокус сейчас — ${focusForAck ? `«${String(focusForAck).substring(0, 120)}»` : "[selected_focus]"}. [один разворачивающий вопрос текущей стадии]»\n`) +
      (mappingStage.primary_answer ? `• первичный процесс (из слов пользователя): «${String(mappingStage.primary_answer).substring(0, 120)}»\n` : "") +
      (mappingStage.secondary_answer ? `• вторичный процесс (из слов пользователя): «${String(mappingStage.secondary_answer).substring(0, 120)}»\n` : "") +
      `ЗАПРЕЩЕНО: снова спрашивать про картирование / выбор фокуса. ЗАПРЕЩЕНО: просить пользователя повторить уже сказанное.`
    : "";

  const needsMapping = !mappingStageComplete && !isIntegrationStage;

  const forcedNext = isIntegrationStage
    ? null
    : needsMapping
    ? null
    : getForcedNextLayer(currentMode, coveredLayers, mappingStage);
  const isLooping = detectLoopInLastExchanges(messages);

  const layerStatus = coveredLayers.size > 0
    ? `\n\n━━━ УЖЕ ПРОЙДЕННЫЕ СЛОИ (НЕ возвращайся к ним) ━━━\n${[...coveredLayers].map((l) => `✓ ${l}`).join("\n")}`
    : "";

  const modeKey = getModeKey(currentMode);
  const INITIAL_MATERIAL_QUESTIONS = {
    body: {
      ru: "Что в теле ты хочешь исследовать сейчас? Это может быть симптом, напряжение, ощущение, боль, усталость или любой телесный сигнал.",
      es: "¿Qué señal del cuerpo quieres explorar ahora? Puede ser un síntoma, una tensión, una sensación, dolor, cansancio o cualquier señal corporal.",
    },
    conflict: {
      ru: "Опиши, пожалуйста, конфликт, который ты хочешь исследовать. Какие стороны, желания или позиции в нём сталкиваются?",
      es: "Describe, por favor, el conflicto que quieres explorar. ¿Qué partes, deseos o posiciones chocan en él?",
    },
    journaling: {
      ru: "О чём ты хочешь поисследовать сегодня? Это может быть ситуация, чувство, вопрос, мысль или тема, которая сейчас занимает внимание.",
      es: "¿Qué quieres explorar hoy? Puede ser una situación, una emoción, una pregunta, un pensamiento o un tema que ocupa tu atención.",
    },
  };
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
    const initialStageForMode = INITIAL_MATERIAL_STAGE[modeKey];
    if (initialStageForMode && mappingStage.stage === initialStageForMode) {
      const q = (INITIAL_MATERIAL_QUESTIONS[modeKey] || {})[language === "es" ? "es" : "ru"];
      console.warn("[INITIAL_MATERIAL_REQUIRED]", { mode: modeKey, stage: mappingStage.stage, primaryQuestionBlocked: true });
      mappingStageInstruction = `\n\n🔴 СТАДИЯ: СБОР ИСХОДНОГО МАТЕРИАЛА (${mappingStage.stage})\n` +
        `Пользователь ещё НЕ описал материал для этого режима. Задай ТОЛЬКО:\n` +
        `«${q}»\n\n` +
        `АБСОЛЮТНО ЗАПРЕЩЕНО до получения материала:\n` +
        `✗ Вопросы про первичный/вторичный процесс\n` +
        `✗ «что здесь знакомо», «что для тебя привычно», «какая сторона привычнее»\n` +
        `✗ Вопросы про тело-исследование, образы, смысл\n` +
        `✗ Любые уточнения, рефлексии, интерпретации`;
    } else if (mappingStage.stage === "awaiting_dream") {
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
  const ENERGY_SELECTION_MARKERS = [
    "знакомое", "непривычное", "на что тебе сейчас хочется",
    "цепляет", "больше энергии", "самым живым", "самым заряженным",
    "сильнее всего", "притягивающим", "притягивает", "удивляет",
    "внимание само возвращается", "самым необычным",
  ];
  const assistantReflectedMap = messagesAfterSecondary.some((m) => m.role === "assistant" && ENERGY_SELECTION_MARKERS.some((mk) => m.content.toLowerCase().includes(mk)));
  if (mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer && !assistantReflectedMap) {
    console.warn("[ENERGY_SELECTION_REQUIRED]", { mode: getModeKey(currentMode), reflectionPending: true });
  }
  const userSelectedFocus = assistantReflectedMap && messagesAfterSecondary.some((m) => m.role === "user");

  // ── Stage memory locks + anti-regression state (SINGLE SOURCE OF TRUTH) ──────
  const userChangedFocus = detectFocusChange(userMessage);
  const lastInterventionType = detectLastInterventionType(messages);
  const sessionState = buildSessionState({
    mappingStage,
    userSelectedFocus,
    isIntegrationStage,
    completionDetected: completionDetection.isComplete,
    coveredLayers,
    resistanceCount,
    lastInterventionType,
    userFrustrationDetected: userAlreadyAnswered,
  });
  console.log("[SESSION_STATE]", {
    stage_rank: sessionState.current_stage_rank,
    selected_focus: sessionState.selected_process_focus,
    current_process_target: sessionState.current_process_target,
    focus_locked: sessionState.focus_locked,
    exploration_depth: sessionState.exploration_depth,
    integration_detected: sessionState.integration_detected,
    closure_detected: sessionState.closure_detected,
    resistance_count: sessionState.resistance_count,
    last_intervention_type: sessionState.last_intervention_type,
    user_frustration_detected: sessionState.user_frustration_detected,
    userChangedFocus,
  });

  // ── SESSION STATE — SOURCE OF TRUTH prompt block (after systemPrompt, before steps) ──
  const sessionStateBlock =
    `\n\n━━━ CURRENT SESSION STATE — SOURCE OF TRUTH ━━━\n` +
    `• stage_rank: ${sessionState.current_stage_rank} (${sessionState.current_stage})\n` +
    `• primary_locked: ${sessionState.primary_locked}\n` +
    `• secondary_locked: ${sessionState.secondary_locked}\n` +
    `• focus_locked: ${sessionState.focus_locked}\n` +
    (sessionState.selected_process_focus ? `• selected_focus: «${String(sessionState.selected_process_focus).substring(0, 140)}»\n` : "") +
    (sessionState.current_process_target ? `• current_process_target: «${String(sessionState.current_process_target).substring(0, 140)}»\n` : "") +
    `• exploration_active: ${sessionState.exploration_active} (depth ${sessionState.exploration_depth})\n` +
    `\nYou must NOT ask questions from stages below current_stage_rank.\n` +
    (sessionState.current_process_target
      ? `You MUST continue unfolding current_process_target. Every next question must explicitly refer to it.\n`
      : "") +
    (sessionState.focus_locked
      ? `Focus is already locked — do NOT return to mapping, image selection, energy selection, primary or secondary questions.\n`
      : "") +
    (sessionState.exploration_active && sessionState.exploration_depth < 2
      ? `Integration / life-connection questions are NOT yet allowed (need exploration_depth >= 2).\n`
      : "") +
    (sessionState.last_intervention_type
      ? `• last_intervention_type: ${sessionState.last_intervention_type} — do NOT use the same intervention type again this turn; pick a different one (immersion, amplification, body, resource, polarity, movement, atmosphere, dialogue, edge, temporal).\n`
      : "");

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

  // ModeStep wins when a valid step exists — only let NEXT_LAYER_INSTRUCTIONS drive when step is missing.
  const forcedInstruction = !hasValidStep && !isIntegrationStage && !completionDetection.isComplete && mappingStageComplete && forcedNext && NEXT_LAYER_INSTRUCTIONS[forcedNext]
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

  // FOCUS LOCK — once focus is selected, force unfolding (no return to mapping/image/energy)
  const focusTarget = mappingStage.current_process_target || mappingStage.selected_focus;
  const focusContinuity = (mappingStage.focus_locked || mappingStage.exploration_active)
    ? `\n\n🔒 ФОКУС ЗАБЛОКИРОВАН — РАЗВОРАЧИВАНИЕ АКТИВНО\n` +
      (focusTarget
        ? `Текущая цель процесса (current_process_target): «${String(focusTarget).substring(0, 160)}». Каждый следующий вопрос ДОЛЖЕН явно ссылаться на неё.\n`
        : `Пользователь уже выбрал фокус и начал его разворачивать.\n`) +
      `ЗАПРЕЩЕНО возвращаться к: сбору материала, первичному/вторичному вопросу, выбору энергии, выбору образа сна.\n` +
      `ЗАПРЕЩЕНЫ фразы: «какой момент сна был самым ярким», «какой образ сна», «что кажется странным», «что больше всего откликается», «где больше энергии», «что из этого цепляет».\n` +
      `ОБЯЗАТЕЛЬНО: продолжай разворачивать именно выбранный фокус. Примеры:\n` +
      `RU: «Если этот образ продолжает расширяться, что происходит дальше?» / «Что становится возможным, когда в тебе есть этот свет, изобилие и рост?» / «Как меняется твоё состояние, когда этот образ занимает больше пространства?»\n` +
      `ES: «Si esto sigue expandiéndose, ¿qué ocurre después?» / «¿Qué se vuelve posible cuando hay en ti esta luz, abundancia y crecimiento?»`
    : "";

  const terms = await fetchRelatedTerms(step?.related_term_ids);
  if (terms.length) {
    console.log("[TERMS_CONTEXT_LOADED]", { count: terms.length, term_names: terms.map((t) => t.term) });
  }
  const termsContext = terms.length
    ? "\n\nРелевантные концепции Process Work (используй ТОЛЬКО внутренне, чтобы выбрать правильный тип вмешательства):\n" +
      terms
        .map((t) => `• ${t.term}: ${t.short_definition || ""}${t.practical_application ? " | Применение: " + t.practical_application : ""}`)
        .join("\n") +
      "\n\nНе объясняй теорию, если пользователь не просит. Не выдавай определения. Используй термины, чтобы выбрать правильный вопрос."
    : "";

  // ModeStep may not move the session backwards. Once exploration/integration/closure
  // is active (rank >= 5), ModeStep becomes advisory — SessionState wins.
  const modeStepDemoted = hasValidStep && sessionState.current_stage_rank >= 5;
  const stepContext = !hasValidStep
    ? "\n\nВсе шаги пройдены. Мягко и тепло завершай сессию — без новых вопросов."
    : modeStepDemoted
    ? `\n\n━━━ MODE_STEP (ТОЛЬКО СОВЕЩАТЕЛЬНО — SESSION STATE ВЫШЕ) ━━━\n` +
      `Текущая стадия rank ${sessionState.current_stage_rank} (${sessionState.current_stage}). ` +
      `Шаг ModeStep («${step.goal || step.question || ""}») может относиться к более ранней стадии. ` +
      `НЕ возвращай сессию назад. Если шаг просит картирование/выбор образа/выбор фокуса — НЕ выполняй его, ` +
      `а продолжай разворачивать текущий фокус` +
      (sessionState.current_process_target ? ` («${String(sessionState.current_process_target).substring(0, 120)}»)` : "") + ".\n"
    : buildModeStepInstruction(step, language);

  const modeShiftHint = step?.possible_mode_shift
    ? `\n\nВозможный переход: ${step.possible_mode_shift}. Если это уместно — предложи пользователю: включи в конец ответа фразу «[SHIFT_SUGGEST:${step.pending_mode || ""}]» чтобы система показала кнопки выбора. Делай это только если смена режима явно уместна.`
    : "";

  const buildPrompt = (extraInstruction = "") =>
    `${SYSTEM_PROMPT}${languageOverride}${sessionStateBlock}${memoriesBlock}${stepContext}${termsContext}${modeShiftHint}${layerStatus}${dreamMapContext}${mappingStageInstruction}${alreadyAnsweredInstruction}${mappingCompleteContext}${primaryThreadGuard}${integrationLock}${closureInstruction}${forcedInstruction}${loopWarning}${focusContinuity}${edgeLimitInstruction}${beginnerChoicesInstruction}${extraInstruction}

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

  if (hasValidStep) {
    console.log("[MODESTEP_ACTIVE]", {
      mode_id: currentMode,
      current_step: step.step_number ?? "?",
      step_key: step.step_key || "—",
      goal: step.goal || "—",
      question: step.question || "—",
      related_term_ids: step.related_term_ids || "—",
    });
  }

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
    const trimmedPrompt = `${SYSTEM_PROMPT}${languageOverride}${memoriesBlock}${stepContext}${layerStatus}${alreadyAnsweredInstruction}${integrationLock}${forcedInstruction}${loopWarning}

Режим: ${currentMode}

━━━ ИСТОРИЯ РАЗГОВОРА ━━━
${trimmedHistory}

━━━ ПОСЛЕДНЕЕ СООБЩЕНИЕ ЧЕЛОВЕКА ━━━
${userMessage}

Напиши 1 отражение и 1 вопрос к следующему слою. Строго 2–3 предложения.`;
    try {
      const r = await base44.functions.invoke("invokeAI", { prompt: trimmedPrompt });
      return r.data?.response || getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold, language);
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
    step,
    hasValidStep,
    sessionId: session.id,
    userAlreadyAnswered,
    mappingStageObj: mappingStage,
    sessionState,
    userChangedFocus,
  };

  // ── Pass 1: initial generation ────────────────────────────────────────────
  let firstResponse;
  try {
    console.log("[AI_RUNTIME] Calling InvokeLLM (pass 1), est tokens:", estimatedTokens);
    firstResponse = (await base44.functions.invoke("invokeAI", { prompt: fullPrompt })).data?.response;
    console.log("[AI_RUNTIME] InvokeLLM pass 1 success, response length:", firstResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 1):", e?.message, String(e));
    const minimalPrompt = `Ты Process Work guide. Задавай один мягкий вопрос.\n\nПоследнее сообщение пользователя: ${userMessage}`;
    try {
      const safeResponse = (await base44.functions.invoke("invokeAI", { prompt: minimalPrompt })).data?.response;
      return safeResponse || getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold, language);
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
    secondResponse = (await base44.functions.invoke("invokeAI", { prompt: buildPrompt(retryInstruction) })).data?.response;
    console.log("[AI_RUNTIME] InvokeLLM pass 2 success, response length:", secondResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 2):", e?.message);
    return getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold, language);
  }

  const secondValidation = validateAssistantResponse({ responseText: secondResponse, ...validationParams });

  if (secondValidation.isValid) {
    console.info("[AI_RUNTIME] Pass 2 passed validation.");
    return secondResponse;
  }

  console.warn("[AI_RUNTIME] Pass 2 also failed validation:", secondValidation.reason);
  const fallback = getSafeFallback(currentMode, forcedNext, isIntegrationStage, mappingStage, isMismatch, isDreamAlreadyTold, language);
  console.info("[AI_RUNTIME] Using safe fallback:", fallback);
  return fallback;
}

// ─── Session summary ─────────────────────────────────────────────────────────
const FALLBACK_SUMMARY = {
  summary: "Сессия завершена. Резюме недоступно.",
  themes: [],
  signals: [],
  next_step_suggestion: "",
  confidence_note: "Это автоматическое резюме. Проверь, насколько оно тебе откликается.",
  memories: [],
};

export async function generateSessionSummary(session, messages, language = "ru") {
  const lang = language === "es" ? "es" : "ru";
  const conversation = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 15000)
  );

  const confidenceNote = lang === "es"
    ? "Este resumen es automático. Comprueba si refleja tu experiencia."
    : "Это автоматическое резюме. Проверь, насколько оно тебе откликается.";

  const langInstruction = lang === "es"
    ? "Escribe TODO en español natural."
    : "Пиши ВСЁ на русском языке.";

  const llmPromise = base44.functions.invoke("invokeAI", {
    prompt: `Ты — процессуально-ориентированный фасилитатор. Проанализируй эту сессию и выдай ТОЛЬКО JSON без markdown:
{
  "summary": "описательный абзац 3-5 предложений — что звучало и что исследовалось в сессии",
  "themes": ["тема 1", "тема 2", "тема 3"],
  "signals": ["телесный или эмоциональный сигнал 1", "сигнал 2"],
  "next_step_suggestion": "одна возможная тема для следующей сессии",
  "confidence_note": "${confidenceNote}"
}

🔴 КРИТИЧЕСКОЕ ПРАВИЛО — НЕ ВЫДУМЫВАЙ РЕЗУЛЬТАТЫ КЛИЕНТА:
НЕ утверждай, что клиент понял, осознал, достиг, к чему-то пришёл или что-то интегрировал — ЕСЛИ пользователь не сказал это прямо.

ЗАПРЕЩЕНО:
✗ «ты поняла», «ты осознала», «ты пришла к», «ты смогла»
✗ «у тебя появился», «стало ясно», «произошла трансформация»

РАЗРЕШЕНО (описательно, не оценочно):
✓ «В сессии звучали...»
✓ «Пользователь исследовала...»
✓ «Появлялись темы...»
✓ «Были отмечены...»
✓ «В конце сессии пользователь сказала...»
✓ «Возможная тема для следующей сессии...»

Резюме должно быть ОПИСАТЕЛЬНЫМ, а не оценочным. Не приписывай инсайты, которых пользователь не выразил словами.

🔴 ОПИРАЙСЯ ТОЛЬКО НА СКАЗАННОЕ ЯВНО:
Опирайся только на то, что пользователь сказал явно. Не домысливай. Если пользователь не пришёл к выводу — напиши "Сессия завершена без итогового осознания" вместо придуманного резюме. Резюме начинается со слов пользователя, а не с интерпретации ИИ.

${langInstruction} Будь конкретным, опирайся на реальные слова из диалога.

Режим: ${session.mode_id || session.mode}

Сессия:
${conversation}`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        themes: { type: "array", items: { type: "string" } },
        signals: { type: "array", items: { type: "string" } },
        next_step_suggestion: { type: "string" },
        confidence_note: { type: "string" },
      },
    },
  });

  try {
    const res = await Promise.race([llmPromise, timeoutPromise]);
    return res?.data?.response || FALLBACK_SUMMARY;
  } catch (e) {
    console.error("Summary generation failed:", e.message);
    return FALLBACK_SUMMARY;
  }
}