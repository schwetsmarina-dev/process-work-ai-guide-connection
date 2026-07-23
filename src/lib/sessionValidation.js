// ─── Assistant response validation + safe fallbacks ─────────────────────────
// Extracted from sessionAI.js. SessionState-driven guards run first, then the
// legacy stage/phrase gates. Pure functions — no network calls.

import {
  validateNoStageRegression,
  detectLastInterventionType,
} from "@/lib/stageLocks";

// The phrase gates below are substring matches against the ASSISTANT's own
// output. They must therefore exist in every language the facilitator speaks,
// otherwise the guardrails silently pass everything through in that language.
const FORBIDDEN_PHRASES = [
  // RU
  "этот образ", "этот элемент", "данный объект",
  "это означает", "это указывает на", "это говорит о том", "это связано с",
  "давайте", "давайте начнём",
  "как образ", "каким образом это могло бы проявиться", "какой метафорой",
  // ES
  "esta imagen", "este elemento", "este objeto",
  "esto significa", "esto indica", "esto nos dice que", "esto está relacionado con",
  "vamos a empezar", "vamos a comenzar",
  "como imagen", "de qué manera podría manifestarse", "con qué metáfora",
];

const TRANSFORMATION_VALID_KEYWORDS = [
  // RU
  "что происходит", "что меняется", "что изменяется",
  "неожиданн", "удивительн", "странн",
  "хочется продолжить", "хочется остановиться", "что тянет",
  // ES
  "qué está pasando", "qué ocurre ahora", "qué cambia", "qué se transforma",
  "inesperad", "sorprend", "extrañ",
  "quieres continuar", "quieres parar", "qué te atrae",
];

const TRANSFORMATION_INVALID_PHRASES = [
  // RU
  "что это значит", "что он хочет сказать", "что это показывает",
  "какое послание", "где это в жизни", "каким образом это связано",
  // ES
  "qué significa esto", "qué quiere decirte", "qué te muestra esto",
  "qué mensaje", "dónde está esto en tu vida", "cómo se relaciona esto con",
];

const INTEGRATION_INVALID_PHRASES = [
  // RU
  "каким образом это стало бы образом", "если бы это было метафорой",
  "что этот образ хочет сказать", "какое движение появляется", "где в теле",
  "каким образом это могло бы проявиться", "какой метафорой",
  "если бы это стало образом", "если бы стало образом", "если бы это было образом",
  "каким образом ты видишь", "какой образ", "представь образ",
  "метафор", "символ", "телесн",
  "что говорит часть", "что хочет часть", "вернёмся к части", "вернись к части",
  "что чувствует та часть", "та часть говорит", "другая часть говорит",
  "что хочет сказать часть", "голос части",
  // ES
  "si esto fuera una metáfora", "si esto se convirtiera en una imagen",
  "qué quiere decir esta imagen", "qué movimiento aparece", "dónde en el cuerpo",
  "de qué manera podría manifestarse", "con qué metáfora",
  "si se convirtiera en imagen", "qué imagen", "imagina una imagen",
  "metáfor", "símbolo", "corporal",
  "qué dice esa parte", "qué quiere esa parte", "volvamos a la parte",
  "qué siente esa parte", "esa parte dice", "la otra parte dice",
  "la voz de la parte",
];

export const SAFE_FALLBACKS = {
  awaiting_dream: "Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?",
  awaiting_body_signal: "Что в теле ты хочешь исследовать сейчас? Это может быть симптом, напряжение, ощущение, боль, усталость или любой телесный сигнал.",
  awaiting_conflict_material: "Опиши, пожалуйста, конфликт, который ты хочешь исследовать. Какие стороны, желания или позиции в нём сталкиваются?",
  awaiting_journaling_topic: "О чём ты хочешь поисследовать сегодня? Это может быть ситуация, чувство, вопрос, мысль или тема, которая сейчас занимает внимание.",
  awaiting_primary: "Если смотреть на этот сон целиком — что в нём больше всего откликается с твоей реальной жизнью, привычными чувствами или знакомыми состояниями?",
  awaiting_secondary: "А что в этом сне кажется тебе самым непривычным, странным, новым или не совсем похожим на тебя?",
  mismatch_dream: "Ты права, я перескочил вперёд. Сначала важно услышать сам сон целиком. Расскажи его так, как он тебе запомнился.",
  transformation: "Давай останемся именно в моменте действия. Что происходит прямо сейчас — есть ли что-то неожиданное или меняющееся?",
  immersion: "Что сейчас помогает тебе оставаться в контакте с собой?",
  integration: "Похоже, здесь уже открылось важное состояние. Насколько оно есть в твоей жизни сейчас, а где его пока не хватает?",
  conflict_integration: "Похоже, внутри появляется больше спокойствия и опоры. Как это влияет на твоё ощущение — что становится более честным по отношению к себе?",
  body: "Если дать этому ощущению чуть больше места, что меняется?",
  conflict: "Если дать место обеим сторонам одновременно — что становится заметнее?",
  journaling: "Давай возьмём то, что уже проявилось, и свяжем это с жизнью. Где это сейчас особенно откликается?",
  dream_mapping: "Давай продолжим намечать карту. Что в этом сне кажется более знакомым или устойчивым — а что удивляет или тянет, как будто что-то новое?",
};

export function validateAssistantResponse({ responseText, currentMode, forcedNextLayer, integrationLock, conversationHistory, lastUserMessage, dreamMappingComplete, mappingStageValue, userSelectedFocus, completionDetected, coveredLayers, resistanceCount, step, hasValidStep, sessionId, userAlreadyAnswered, mappingStageObj, sessionState, userChangedFocus }, validationContext) {
  if (!validationContext) validationContext = { completionDetected };
  const lower = responseText.toLowerCase();

  // 0lock. STAGE MEMORY LOCKS + ANTI-REGRESSION (all modes) — runs first.
  // Once primary/secondary/focus is locked, reject re-asking earlier stages.
  if (sessionState) {
    const regression = validateNoStageRegression(responseText, sessionState, userChangedFocus);
    if (!regression.isValid) {
      console.warn(regression.log, {
        session_id: sessionId,
        current_stage: sessionState.current_stage,
        attempted_stage: regression.reason,
        question: responseText.slice(0, 120),
      });
      return {
        isValid: false,
        reason: regression.reason,
        correctedInstruction: regression.correctedInstruction,
      };
    }
  }

  // 0int. PREMATURE INTEGRATION gate (all modes) — block life-integration before exploration_depth >= 2
  if (sessionState && sessionState.exploration_active && (sessionState.exploration_depth || 0) < 2 && !sessionState.integration_detected) {
    const PREMATURE_INTEGRATION_PHRASES = [
      // RU
      "как это связано с жизнью", "где это есть в жизни", "как это применить",
      "что это значит для жизни", "в твоей жизни", "в реальной жизни",
      // ES
      "cómo se relaciona con tu vida", "dónde aparece en tu vida", "cómo aplicarlo",
    ];
    const hit = PREMATURE_INTEGRATION_PHRASES.find((p) => lower.includes(p));
    if (hit) {
      console.warn("[PREMATURE_INTEGRATION_BLOCKED]", {
        mode: (currentMode || "").toLowerCase(),
        exploration_depth: sessionState.exploration_depth,
        triggeredPhrase: hit,
      });
      return {
        isValid: false,
        reason: `Premature integration: life-connection phrase "${hit}" before exploration_depth >= 2`,
        correctedInstruction:
          "Integration is not yet allowed (exploration is too shallow). Continue unfolding " +
          (sessionState.current_process_target ? `«${String(sessionState.current_process_target).substring(0, 120)}»` : "the current focus") +
          " with one more exploration question (immersion, amplification, movement, atmosphere). Do NOT ask about real life yet.",
      };
    }
  }

  // 0clo. CLOSURE STAGE gate — at rank 7 only reflect + one closing question
  if (sessionState && (sessionState.closure_detected || sessionState.current_stage_rank === 7)) {
    const EXPLORATION_PHRASES_AT_CLOSURE = [
      "что начинает происходить", "что происходит дальше", "если усилить",
      "если позволить", "давай исследуем", "пойдём глубже",
    ];
    const hit = EXPLORATION_PHRASES_AT_CLOSURE.find((p) => lower.includes(p));
    if (hit) {
      console.warn("[CLOSURE_STAGE_ACTIVE]", {
        mode: (currentMode || "").toLowerCase(),
        triggeredPhrase: hit,
      });
      return {
        isValid: false,
        reason: `Closure stage active — exploration phrase "${hit}" not allowed`,
        correctedInstruction:
          "Сессия в стадии завершения. Не задавай исследовательских вопросов. " +
          "Отрази дугу процесса, задай ОДИН мягкий закрывающий вопрос и предложи сохранить инсайт.",
      };
    }
  }

  // 0iv. INTERVENTION MEMORY — do not repeat the same intervention type twice in a row
  if (sessionState && sessionState.last_intervention_type && sessionState.exploration_active) {
    const proposedType = detectLastInterventionType([{ role: "assistant", content: responseText }]);
    if (proposedType && proposedType === sessionState.last_intervention_type) {
      console.warn("[INTERVENTION_REPEAT_BLOCKED]", {
        mode: (currentMode || "").toLowerCase(),
        intervention_type: proposedType,
      });
      return {
        isValid: false,
        reason: `Same intervention type "${proposedType}" used twice in a row`,
        correctedInstruction:
          `Previous intervention was "${proposedType}". Choose a DIFFERENT intervention type now ` +
          `(immersion, amplification, body, resource, polarity, movement, atmosphere, dialogue, edge, temporal), ` +
          `still referring to the current focus.`,
      };
    }
  }

  // 0arep. REPEATED STAGE QUESTION — user said they already answered, reject re-asking the same stage question
  if (userAlreadyAnswered) {
    const STAGE_QUESTION_PHRASES = [
      // primary
      "более привычная", "что здесь знакомо", "что для тебя привычно",
      "как ты обычно", "похоже на твой обычный способ", "ближе к тому, как ты обычно",
      "уже понятно, знакомо", "откликается с твоей реальной жизнью",
      // secondary
      "что в этом странное", "что здесь нового", "что непривычное",
      "более новая, непривычная", "труднее принимается", "больше напряжения",
      "самым странным", "не похожим на тебя", "какая часть менее привычная",
      // conflict material re-ask
      "между какими двумя позициями", "какие стороны", "какой конфликт",
    ];
    const repeatedHit = STAGE_QUESTION_PHRASES.find((p) => lower.includes(p));
    if (repeatedHit) {
      console.warn("[REPEATED_STAGE_QUESTION_BLOCKED]", {
        mode: (currentMode || "").toLowerCase(),
        stage: mappingStageValue,
        question: repeatedHit,
      });
      return {
        isValid: false,
        reason: `Repeated stage question after user said they already answered ("${repeatedHit}")`,
        correctedInstruction:
          "Use previous user messages to extract the answer. Do not ask the user to repeat. " +
          "Briefly acknowledge ('Да, ты уже это написала.') then move to the next unanswered stage. " +
          (mappingStageObj?.primary_answer ? `Known primary: "${String(mappingStageObj.primary_answer).substring(0, 100)}". ` : "") +
          (mappingStageObj?.secondary_answer ? `Known secondary: "${String(mappingStageObj.secondary_answer).substring(0, 100)}". ` : ""),
      };
    }
  }

  // 0rep. ANTI-REPEAT against last 5 assistant questions (ModeStep history)
  const REPEATED_STEMS = [
    "что происходит", "что начинает происходить", "что замечаешь",
    "что в этом", "где это", "если бы это могло сказать",
  ];
  const previousAssistantQuestions = (conversationHistory || [])
    .filter((m) => m.role === "assistant")
    .slice(-5)
    .map((m) => m.content.toLowerCase());

  const normalizeQ = (s) => s.replace(/\s+/g, " ").replace(/[«»"".,!?]/g, "").trim();
  const candidateNorm = normalizeQ(lower);
  for (const prevQ of previousAssistantQuestions) {
    const prevNorm = normalizeQ(prevQ);
    const exactRepeat = prevNorm.length > 15 && candidateNorm.includes(prevNorm.slice(0, Math.min(60, prevNorm.length)));
    const sharedStem = REPEATED_STEMS.find((stem) => candidateNorm.includes(stem) && prevNorm.includes(stem));
    if (exactRepeat || sharedStem) {
      console.warn("[MODESTEP_REPEAT_BLOCKED]", {
        session_id: sessionId,
        step_number: step?.step_number ?? "?",
        matched_previous_question: prevQ.slice(0, 120),
      });
      return {
        isValid: false,
        reason: `Repeated question/stem vs previous assistant message${sharedStem ? ` (stem: "${sharedStem}")` : ""}`,
        correctedInstruction: hasValidStep
          ? `Do NOT repeat a previous question or reuse the same stem. Ask ONE new question that advances the current ModeStep — goal: "${step.goal || ""}", direction: "${step.question || ""}". Use the user's exact words.`
          : "Do NOT repeat a previous question or reuse the same stem. Move to the next process layer with a genuinely new question.",
      };
    }
  }

  // 0pre. INITIAL MATERIAL gate (body / conflict / journaling) — block primary/secondary questions
  const INITIAL_MATERIAL_STAGES = ["awaiting_body_signal", "awaiting_conflict_material", "awaiting_journaling_topic"];
  if (INITIAL_MATERIAL_STAGES.includes(mappingStageValue)) {
    const PRIMARY_SECONDARY_PHRASES = [
      "что здесь знакомо", "что для тебя привычно", "что похоже на твой обычный способ",
      "какая сторона привычнее", "что связано с обычной жизнью",
      "как ты обычно объясняешь", "более привычная", "уже понятно, знакомо",
      "что в этом странное", "что здесь нового", "что непривычное",
    ];
    const hit = PRIMARY_SECONDARY_PHRASES.find((p) => lower.includes(p));
    if (hit) {
      const modeForLog = (currentMode || "").toLowerCase();
      console.warn("[INITIAL_MATERIAL_REQUIRED]", { mode: modeForLog, stage: mappingStageValue, primaryQuestionBlocked: true });
      console.warn("[PRIMARY_BEFORE_MATERIAL_BLOCKED]", { mode: modeForLog, stage: mappingStageValue, triggeredPhrase: hit });
      return {
        isValid: false,
        reason: `Initial material gate violated: primary/secondary question asked before material collected ("${hit}")`,
        correctedInstruction: "First collect the user's actual material/complaint/topic for this mode. Do not map primary/secondary yet.",
      };
    }
  }

  // 0. RUSSIAN PROCESS LANGUAGE check — must run first
  const UNNATURAL_RUSSIAN_PATTERNS = [
    "рядом с этим", "рядом с состоянием", "рядом с чувством",
    "рядом со страхом", "рядом с ужасом", "рядом с переживанием",
    "находишься рядом", "останься рядом", "побудь рядом",
  ];
  const unnaturalHit = UNNATURAL_RUSSIAN_PATTERNS.find((p) => lower.includes(p));
  if (unnaturalHit) {
    console.warn("[RUSSIAN_PROCESS_LANGUAGE_BLOCKED]", { triggeredPhrase: unnaturalHit });
    return {
      isValid: false,
      reason: `Unnatural Russian facilitation phrase: "${unnaturalHit}"`,
      correctedInstruction:
        "Do NOT use Russian phrasing with 'рядом с состоянием/чувством'. " +
        "Use natural immersion phrasing: " +
        "'если ты продолжаешь чувствовать...' / " +
        "'если это состояние разворачивается дальше...' / " +
        "'если не отталкивать это чувство...' / " +
        "'если позволить этому происходить...'",
    };
  }

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


  // 0pre-b. SECONDARY-BEFORE-PRIMARY gate — block secondary question while still awaiting primary answer
  if (mappingStageValue === "awaiting_primary") {
    const SECONDARY_PHRASES = [
      "что в этом сне кажется тебе самым странным", "не похожим на тебя",
      "что в этом телесном ощущении странное", "не совсем твоё",
      "более новая, непривычная", "труднее принимается", "больше напряжения",
      "новым, странным, живым", "тревожащим, непривычным",
      "что здесь нового", "что в этом странное", "что непривычное",
    ];
    const secHit = SECONDARY_PHRASES.find((p) => lower.includes(p));
    if (secHit) {
      console.warn("[SECONDARY_BEFORE_PRIMARY_BLOCKED]", { mode: (currentMode || "").toLowerCase(), triggeredPhrase: secHit });
      return {
        isValid: false,
        reason: `Secondary question asked before primary answer ("${secHit}")`,
        correctedInstruction: "Primary process has not been answered yet. Ask the primary-process question first (what is familiar/known/habitual). Do NOT ask the secondary-process question yet.",
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
      console.warn("[PREMATURE_MESSAGE_BLOCKED]", { mode: (currentMode || "").toLowerCase(), triggeredPhrase: prematureVoiceHit });
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
        console.warn("[AUTO_FOCUS_SELECTION_BLOCKED]", { mode: (currentMode || "").toLowerCase(), triggeredPhrase: phrase });
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
        console.warn("[PREMATURE_INTEGRATION_BLOCKED]", { mode: (currentMode || "").toLowerCase(), triggeredPhrase: phrase });
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

  // 7. ModeStep relevance check — response must relate to the step goal/question keywords.
  // Only enforced when a valid step exists AND no process gate is overriding it.
  const GATE_STAGES = [
    "awaiting_dream", "awaiting_body_signal", "awaiting_conflict_material",
    "awaiting_journaling_topic", "awaiting_primary", "awaiting_secondary",
  ];
  const gateActive = GATE_STAGES.includes(mappingStageValue) || integrationLock || completionDetected || (resistanceCount || 0) >= 3;
  if (hasValidStep && !gateActive) {
    const stripWords = (s) => (s || "")
      .toLowerCase()
      .replace(/[«»"".,!?;:()\-—]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    const stepKeywords = [...new Set([...stripWords(step.goal), ...stripWords(step.question)])];
    if (stepKeywords.length >= 3) {
      const overlap = stepKeywords.filter((kw) => lower.includes(kw.slice(0, 5)));
      if (overlap.length === 0) {
        console.warn("[MODESTEP_IGNORED_BLOCKED]", {
          session_id: sessionId,
          step_number: step?.step_number ?? "?",
          step_goal: step.goal,
        });
        return {
          isValid: false,
          reason: "Response unrelated to the current ModeStep goal/question",
          correctedInstruction: `Return to the current ModeStep. Ask one question that advances step.goal ("${step.goal || ""}") and step.question ("${step.question || ""}"). Do not use a generic fallback.`,
        };
      }
    }
  }

  return { isValid: true, reason: "", correctedInstruction: "" };
}

export function getSafeFallback(currentMode, forcedNextLayer, integrationLock, mappingStage, isMismatch, isDreamAlreadyTold) {
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
  if (mappingStage?.stage === "awaiting_body_signal") return SAFE_FALLBACKS.awaiting_body_signal;
  if (mappingStage?.stage === "awaiting_conflict_material") return SAFE_FALLBACKS.awaiting_conflict_material;
  if (mappingStage?.stage === "awaiting_journaling_topic") return SAFE_FALLBACKS.awaiting_journaling_topic;
  if (mappingStage?.stage === "awaiting_primary") return SAFE_FALLBACKS.awaiting_primary;
  if (mappingStage?.stage === "awaiting_secondary") return SAFE_FALLBACKS.awaiting_secondary;
  if (forcedNextLayer === "transformation") return SAFE_FALLBACKS.transformation;
  if (forcedNextLayer === "immersion") return SAFE_FALLBACKS.immersion;
  if (modeKey.includes("body")) return SAFE_FALLBACKS.body;
  if (modeKey.includes("conflict")) return SAFE_FALLBACKS.conflict;
  if (modeKey.includes("journal")) return SAFE_FALLBACKS.journaling;
  return SAFE_FALLBACKS.integration;
}