// ─── Stage memory locks + anti-regression (ALL MODES) ───────────────────────
// Once a stage is completed it CANNOT be reopened (unless the user explicitly
// changes focus). This module derives a sessionState from the conversation and
// rejects assistant responses that belong to an earlier stage.

// Ordered stage ranks. Higher rank = later in the process.
export const STAGE_RANK = {
  material: 1,
  primary: 2,
  secondary: 3,
  focus_selection: 4,
  exploration: 5,
  integration: 6,
  closure: 7,
};

// User signals that they explicitly change focus / introduce new material →
// allows reopening earlier stages.
const FOCUS_CHANGE_SIGNALS = [
  // RU
  "хочу сменить", "давай про другое", "другая тема", "новая тема",
  "забудь про", "вернёмся к другому", "поговорим о другом", "это уже не важно",
  "хочу о другом", "сменим фокус", "другой образ", "другой вопрос",
  // ES
  "quiero cambiar", "otro tema", "tema nuevo", "olvida", "hablemos de otra cosa",
  "cambiar de enfoque", "otra imagen", "otra pregunta", "ya no importa",
];

export function detectFocusChange(userMessage) {
  const lower = (userMessage || "").toLowerCase();
  return FOCUS_CHANGE_SIGNALS.some((s) => lower.includes(s));
}

// Build the locked sessionState from the mapping stage + covered layers.
// mappingStage comes from detectProcessMappingStage; coveredLayers is a Set.
export function buildSessionState({ mappingStage, userSelectedFocus, isIntegrationStage, completionDetected, coveredLayers }) {
  const primary_locked = !!mappingStage?.primary_answer;
  const secondary_locked = !!mappingStage?.secondary_answer;
  const focus_locked = !!userSelectedFocus || !!mappingStage?.selected_focus || !!mappingStage?.focus_locked;
  const exploration_active = !!mappingStage?.exploration_active || focus_locked;

  const selected_process_focus =
    mappingStage?.selected_focus || null;
  const current_process_target =
    mappingStage?.current_process_target || selected_process_focus || null;

  // Number of distinct exploration-layer covered → exploration depth.
  const EXPLORATION_LAYERS = [
    "immersion", "transformation", "interaction", "movement",
    "image", "atmosphere", "message", "part_b", "quality", "emotion", "localization",
  ];
  const exploration_depth = coveredLayers
    ? EXPLORATION_LAYERS.filter((l) => coveredLayers.has(l)).length
    : 0;

  // Determine current highest reached stage rank.
  let currentStage = "material";
  if (primary_locked) currentStage = "primary";
  if (secondary_locked) currentStage = "secondary";
  if (focus_locked) currentStage = "focus_selection";

  // Exploration is active once focus is locked OR the user is actively unfolding.
  if (exploration_active || (focus_locked && exploration_depth >= 1)) {
    currentStage = "exploration";
  }
  if (isIntegrationStage) currentStage = "integration";
  if (completionDetected) currentStage = "closure";

  return {
    primary_locked,
    secondary_locked,
    focus_locked,
    exploration_active,
    selected_process_focus,
    current_process_target,
    current_exploration_target: current_process_target,
    exploration_depth,
    integration_detected: !!isIntegrationStage,
    closure_detected: !!completionDetected,
    current_stage: currentStage,
    current_stage_rank: STAGE_RANK[currentStage] || 1,
  };
}

// Phrase banks that identify which stage a PROPOSED assistant response belongs to.
const PRIMARY_ASK_PHRASES = [
  "что здесь знакомо", "что для тебя привычно", "более привычная",
  "как ты обычно", "похоже на твой обычный способ", "ближе к тому, как ты обычно",
  "уже понятно, знакомо", "откликается с твоей реальной жизнью",
  "что в этой ситуации для тебя уже понятно",
  // ES
  "qué te resulta familiar", "más familiar", "tu forma habitual", "ya lo conoces",
];

const SECONDARY_ASK_PHRASES = [
  "что в этом странное", "что здесь нового", "что непривычное", "самым странным",
  "не похожим на тебя", "более новая, непривычная", "труднее принимается",
  "больше напряжения", "новым, странным, живым", "тревожащим, непривычным",
  "что удивляет", "что заряжено",
  // ES
  "qué es extraño", "qué es nuevo", "poco habitual", "qué te sorprende",
];

const FOCUS_SELECTION_ASK_PHRASES = [
  "что из этого цепляет", "что цепляет сильнее всего", "где больше энергии",
  "что самым ярким", "что самым заряженным", "что притягивает",
  "что сейчас кажется тебе самым необычным", "самым живым",
  "какой момент сна был самым ярким", "что было самым ярким",
  "что больше всего привлекает внимание", "что выделяется",
  "какой образ из этого сна самый яркий", "что в этом сне было самым",
  // ES
  "qué te atrae más", "dónde hay más energía", "qué es lo más vivo",
  "qué momento fue el más vívido", "qué destaca",
];

// Map the proposed response text → the lowest stage it implies.
export function classifyProposedStage(responseText) {
  const lower = (responseText || "").toLowerCase();
  if (PRIMARY_ASK_PHRASES.some((p) => lower.includes(p))) return "primary";
  if (SECONDARY_ASK_PHRASES.some((p) => lower.includes(p))) return "secondary";
  if (FOCUS_SELECTION_ASK_PHRASES.some((p) => lower.includes(p))) return "focus_selection";
  return null;
}

// Hard-blocked phrases once focus is locked OR exploration is active (all modes).
const FOCUS_LOCKED_FORBIDDEN_PHRASES = [
  // RU
  "какой момент сна", "какой образ сна", "самым ярким", "что кажется странным",
  "что кажется непривычным", "что в этом знакомо", "что больше всего откликается",
  "где больше энергии", "что из этого цепляет",
  // ES
  "qué momento del sueño", "qué imagen del sueño", "lo más llamativo",
  "qué parece extraño", "qué parece poco habitual", "qué te resulta familiar",
  "dónde hay más energía", "qué te toca más",
];

// Core anti-regression validator. Returns { isValid, reason, correctedInstruction, log }.
export function validateNoStageRegression(responseText, sessionState, userChangedFocus) {
  if (userChangedFocus) {
    return { isValid: true };
  }

  const lowerResp = (responseText || "").toLowerCase();

  // FOCUS LOCK HARD BLOCK — once focus locked or exploration active, reject any
  // mapping / image-selection / energy-selection phrase outright.
  if (sessionState.focus_locked || sessionState.exploration_active) {
    const hit = FOCUS_LOCKED_FORBIDDEN_PHRASES.find((p) => lowerResp.includes(p));
    if (hit) {
      return {
        isValid: false,
        log: "[FOCUS_REGRESSION_BLOCKED]",
        reason: `Focus locked / exploration active — forbidden mapping phrase "${hit}" (rank ${sessionState.current_stage_rank})`,
        correctedInstruction:
          "Focus is already locked. Continue unfolding selected_process_focus. " +
          "Do not return to mapping, image selection, or energy selection. " +
          (sessionState.selected_process_focus
            ? `Выбранный фокус: «${String(sessionState.selected_process_focus).substring(0, 120)}». `
            : "") +
          "Пример: «Если этот образ продолжает расширяться, что происходит дальше?»",
      };
    }
  }

  const proposedStage = classifyProposedStage(responseText);
  if (!proposedStage) return { isValid: true };

  const proposedRank = STAGE_RANK[proposedStage];
  const currentRank = sessionState.current_stage_rank;

  // 1. PRIMARY lock
  if (proposedStage === "primary" && sessionState.primary_locked) {
    return {
      isValid: false,
      log: "[PRIMARY_REGRESSION_BLOCKED]",
      reason: "Primary process already locked — assistant asked the primary question again",
      correctedInstruction:
        "Первичный процесс уже определён и зафиксирован. НЕ спрашивай снова, что знакомо/привычно/обычно. " +
        "Продолжай с текущей стадии (" + sessionState.current_stage + "), опираясь на выбранный фокус: " +
        (sessionState.selected_process_focus ? `«${String(sessionState.selected_process_focus).substring(0, 120)}»` : "уже выбранный фокус") + ".",
    };
  }

  // 2. SECONDARY lock
  if (proposedStage === "secondary" && sessionState.secondary_locked) {
    return {
      isValid: false,
      log: "[SECONDARY_REGRESSION_BLOCKED]",
      reason: "Secondary process already locked — assistant asked the secondary question again",
      correctedInstruction:
        "Вторичный процесс уже определён и зафиксирован. НЕ спрашивай снова, что странное/новое/непривычное. " +
        "Продолжай с текущей стадии (" + sessionState.current_stage + "), опираясь на выбранный фокус.",
    };
  }

  // 3. FOCUS lock
  if (proposedStage === "focus_selection" && sessionState.focus_locked) {
    return {
      isValid: false,
      log: "[FOCUS_REGRESSION_BLOCKED]",
      reason: "Focus already selected — assistant asked for focus / most-vivid element again",
      correctedInstruction:
        "Фокус уже выбран пользователем. НЕ спрашивай снова «что самое яркое / что цепляет / какой образ ярче». " +
        (sessionState.selected_process_focus
          ? `Ссылайся явно на выбранный фокус: «${String(sessionState.selected_process_focus).substring(0, 120)}» и продолжай его разворачивание. `
          : "Ссылайся на уже выбранный фокус и продолжай его разворачивание. ") +
        "Например: «Если этот образ продолжает разворачиваться — что начинает происходить дальше?»",
    };
  }

  // 4. General stage-rank regression (exploration/integration active → mapping question)
  if (proposedRank < currentRank) {
    return {
      isValid: false,
      log: "[STAGE_REGRESSION_BLOCKED]",
      reason: `Stage regression: current stage "${sessionState.current_stage}" (rank ${currentRank}) but proposed "${proposedStage}" (rank ${proposedRank})`,
      correctedInstruction:
        `Текущая стадия — ${sessionState.current_stage}. Запрещено возвращаться к стадии «${proposedStage}» (картирование/выбор фокуса). ` +
        "Все следующие вопросы должны продолжать исследование выбранного фокуса: иммерсия, усиление, атмосфера, импульс движения, телесное переживание, полярность, диалог ролей, разворачивание во времени, ресурс или интеграция. " +
        (sessionState.selected_process_focus
          ? `Выбранный фокус: «${String(sessionState.selected_process_focus).substring(0, 120)}».`
          : ""),
    };
  }

  return { isValid: true };
}