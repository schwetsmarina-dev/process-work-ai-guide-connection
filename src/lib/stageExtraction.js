// ─── Global semantic stage extraction (all modes) ───────────────────────────
// Detects already-given stage answers from ALL prior user messages so the
// assistant never forces the user to repeat what they already said.

const PRIMARY_SEMANTIC_MARKERS = [
  // RU
  "привычная часть", "более привычная", "знакомая часть", "это мне знакомо",
  "обычно я", "мой обычный способ", "это похоже на меня", "мне ближе",
  "повседневная часть", "я обычно", "мне понятно", "это понятно",
  "это уже знакомо",
  // ES
  "la parte habitual", "más familiar", "me resulta familiar", "mi forma habitual",
  "se parece a mí", "me es más cercana", "normalmente yo", "esto ya lo conozco",
  "me resulta claro",
];

const SECONDARY_SEMANTIC_MARKERS = [
  // RU
  "странно", "странная часть", "странные для меня", "непривычно", "непривычная часть",
  "новое", "непонятно", "труднее принять", "вызывает напряжение",
  "не похоже на меня", "удивляет", "заряжено", "тянет", "пугает",
  "сопротивляюсь", "не принимаю",
  // ES
  "extraño", "raro", "poco habitual", "nuevo", "difícil de aceptar",
  "no se parece a mí", "me sorprende", "me genera tensión", "me atrae",
  "me asusta", "me resisto", "no lo acepto",
];

const FOCUS_SEMANTIC_MARKERS = [
  // RU
  "сильнее всего", "больше всего цепляет", "самое заряженное", "хочу исследовать",
  "главное", "для меня важнее", "выбираю", "интереснее", "мне хочется пойти туда",
  "больше энергии", "самое живое",
  // ES
  "lo más vivo", "lo que más me toca", "lo más cargado", "quiero explorar",
  "elijo", "me interesa más", "lo más importante", "donde hay más energía",
];

const INTEGRATION_SEMANTIC_MARKERS = [
  // RU
  "в жизни", "в отношениях", "в работе", "в теле", "это проявляется",
  "я могу", "я буду", "я хочу", "я понимаю", "теперь я вижу",
  "это важно для меня", "это связано с",
  // ES
  "en mi vida", "en mis relaciones", "en el trabajo", "esto se manifiesta",
  "puedo", "quiero", "entiendo", "ahora veo", "es importante para mí",
  "está relacionado con",
];

const CLOSURE_SEMANTIC_MARKERS = [
  // RU
  "мне достаточно", "мне стало ясно", "я поняла", "я понял",
  "я знаю что делать", "мне спокойно", "я чувствую силу",
  "я чувствую завершение", "хочу остановиться", "это уже достаточно",
  "я хочу это сохранить",
  // ES
  "me basta", "ahora lo veo claro", "he entendido", "sé qué hacer",
  "me siento tranquila", "me siento tranquilo", "siento fuerza",
  "quiero parar", "esto es suficiente", "quiero conservar esto",
];

// User explicitly says they already answered / asks to re-read prior messages
export const ALREADY_ANSWERED_MARKERS = [
  // RU
  "я же написала", "я же написал", "я уже написала", "я уже написал",
  "я уже ответила", "я уже ответил", "я уже сказала", "я уже сказал",
  "прочитай мое первое сообщение", "прочитай моё первое сообщение",
  "прочитай предыдущее сообщение", "прочитай первое сообщение",
  "прочитай", "сам ответь", "ты повторяешь",
  "я вынуждена повторять", "я вынужден повторять",
  "ты уже спрашивал", "ты уже спрашивала",
  // ES
  "ya lo escribí", "ya respondí", "ya lo dije", "lee mi mensaje anterior",
  "lee mi primer mensaje", "lee el primer mensaje", "respóndelo tú",
  "me estás repitiendo", "ya me lo preguntaste",
];

export function detectUserAlreadyAnswered(userMessage) {
  const lower = (userMessage || "").toLowerCase();
  return ALREADY_ANSWERED_MARKERS.some((m) => lower.includes(m));
}

// Extract the sentence around the first matched marker so we keep concrete words
function extractSentenceAround(text, marker) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(marker);
  if (idx === -1) return null;
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  let cursor = 0;
  for (const s of sentences) {
    const end = cursor + s.length;
    if (idx >= cursor && idx <= end + 1) return s.trim();
    cursor = end + 1;
  }
  return text.slice(Math.max(0, idx - 40), idx + 80).trim();
}

// Scans ALL user messages (not just the last) and detects every stage answer.
// detectInitialMaterialFn is injected to avoid a circular import with sessionAI.
export function extractStageAnswersFromUserMessages(messages, modeKey = null, detectInitialMaterialFn = null) {
  const userMsgs = messages.filter((m) => m.role === "user");
  let initial_material = null;
  let primary_answer = null;
  let secondary_answer = null;
  let selected_focus = null;
  let integration_material = null;
  let closure_signal = null;

  // Initial material — first substantive user message when material signals are present
  if (modeKey && detectInitialMaterialFn && detectInitialMaterialFn(messages, modeKey)) {
    const firstSubstantive = userMsgs.find((m) => m.content.trim().length > 12);
    if (firstSubstantive) {
      initial_material = firstSubstantive.content.slice(0, 200).trim();
    }
  }

  for (const m of userMsgs) {
    const text = m.content;
    const lower = text.toLowerCase();

    if (!primary_answer) {
      const pm = PRIMARY_SEMANTIC_MARKERS.find((mk) => lower.includes(mk));
      if (pm) primary_answer = extractSentenceAround(text, pm) || text;
    }
    if (!secondary_answer) {
      const sm = SECONDARY_SEMANTIC_MARKERS.find((mk) => lower.includes(mk));
      if (sm) secondary_answer = extractSentenceAround(text, sm) || text;
    }
    if (!selected_focus) {
      const fm = FOCUS_SEMANTIC_MARKERS.find((mk) => lower.includes(mk));
      if (fm) selected_focus = extractSentenceAround(text, fm) || text;
    }
    if (!integration_material) {
      const im = INTEGRATION_SEMANTIC_MARKERS.find((mk) => lower.includes(mk));
      if (im) integration_material = extractSentenceAround(text, im) || text;
    }
    if (!closure_signal) {
      const cm = CLOSURE_SEMANTIC_MARKERS.find((mk) => lower.includes(mk));
      if (cm) closure_signal = extractSentenceAround(text, cm) || text;
    }
  }

  return { initial_material, primary_answer, secondary_answer, selected_focus, integration_material, closure_signal };
}