// Dedicated Body-mode Process Work state machine.
// Architecture: symptom -> small u (primary process) -> amplification -> X -> identification with X
// -> unfolding X in the active channel -> big U (secondary process) -> stabilization -> integration.
// X is the disowned signal/energy. X is NOT the secondary process. big U is the secondary process.

const userMessages = (messages) => messages.filter((m) => m.role === "user");
const textOf = (items) => items.map((m) => String(m.content || "").toLowerCase()).join(" ");
const hasAny = (text, signals) => signals.some((s) => text.includes(s));

const SIGNAL = [
  "боль", "болит", "чеш", "зуд", "напряж", "давлен", "сжати", "тяжест", "пульсац",
  "спазм", "жжен", "онем", "дрож", "ощущ", "симптом", "устал", "сердцеби", "головокруж",
  "dolor", "picor", "tensión", "presión", "sensación", "síntoma", "cansancio", "palpit",
];
const LOCALIZATION = [
  "в голове", "в груди", "в животе", "в спине", "в шее", "в плеч", "в рук", "в ног", "в глаз",
  "в виск", "в лбу", "в макуш", "мизин", "слева", "справа", "где именно",
  "en la cabeza", "en el pecho", "en el abdomen", "en la espalda", "en el cuello", "a la izquierda", "a la derecha",
];
const QUALITY = [
  "давлен", "сжати", "тяжест", "пульсац", "жжен", "остр", "туп", "ноющ", "колет", "чеш", "зуд",
  "твёрд", "тверд", "мягк", "горяч", "холод", "вибрац", "режет", "распира",
  "presión", "peso", "contracción", "puls", "ardor", "frío", "calor", "vibr",
];
const IMPACT = [
  "хочется лечь", "хочу лечь", "лежать", "закрываются глаза", "закрыть глаза", "глушит", "ослепляет",
  "яркий свет", "не нравится шум", "мешает шум", "хочется тишины", "не могу смотреть", "не могу слушать",
  "не хочется двиг", "хочется двиг", "мешает работать", "не могу работать", "не могу думать", "тошнит",
  "quiero tumbarme", "cerrar los ojos", "molesta la luz", "molesta el ruido", "quiero silencio", "no puedo trabajar",
];
const TEMPORAL = [
  "давно", "недавно", "часто", "редко", "иногда", "каждый", "раз в", "началось", "начинается", "случается",
  "обычно", "утром", "вечером", "ночью", "час", "день", "недел", "месяц", "год",
  "desde hace", "a menudo", "a veces", "cada", "suele", "por la mañana", "por la noche",
];
const CONTEXT = [
  "после ", "когда ", "если ", "недосып", "не высп", "работ", "нагруз", "стресс", "бег", "спорт", "трениров",
  "еда", "цикл", "дорог", "экран", "ссор", "разговор", "после сна", "после работы",
  "después de", "cuando ", "si ", "estrés", "trabajo", "ejercicio", "pantalla", "dormir",
];

// X may emerge in any channel. These signals are intentionally stricter than ordinary symptom-context words.
// Example: "яркий свет мешает" belongs to small u; it must not be misread as a visual X.
const X_VISUAL = [
  "образ", "похоже на", "как будто это", "напоминает", "я вижу", "представляю", "видится", "камень", "каменн",
  "плита", "туман", "существо", "стена", "шар", "волна", "цветок", "рисунок", "imagen", "parece", "veo", "piedra",
];
const X_AUDITORY = [
  "это звучит", "звук как", "слышу", "голос говорит", "голос звучит", "гул как", "писк как", "звон как", "ритм как",
  "suena como", "oigo", "una voz", "un sonido",
];
const X_MOVEMENT = [
  "меня тянет", "меня толкает", "тело тянет", "тело толкает", "скручивает", "хочется сжаться", "хочется распрямиться",
  "движение как", "само движется", "me empuja", "me tira", "quiero encogerme", "quiero estirarme",
];
const X_SENSATION = [
  "если усилить", "становится сильнее", "усиливается и", "нарастает и", "распространяется", "меняет форму", "превращается",
  "al intensificar", "se hace más fuerte", "se extiende", "cambia de forma", "se transforma",
];

const IDENTIFICATION_ASSISTANT = [
  "стань этим", "побудь этим", "если ты —", "если ты становишься", "попробуй быть этим", "войти в этот образ",
  "войти в это ощущение", "представь, что ты —", "sé eso", "si tú eres", "conviértete en",
];
const UNFOLD_ASSISTANT = [
  "как тебе хочется двигаться", "как хочется двигаться", "как тебе хочется дышать", "как хочется дышать",
  "как тебе хочется звучать", "как хочется звучать", "что ты делаешь, когда ты", "позволь этому проявиться",
  "как ты занимаешь пространство", "как это разворачивается", "cómo te apetece moverte", "cómo respiras", "cómo suenas",
];
const BIG_U_ASSISTANT = [
  "какой ты становишься", "какая ты становишься", "какие качества появляются", "какие качества ты чувствуешь",
  "что нового появляется в тебе", "что ты теперь чувствуешь в себе", "что в тебе становится доступно",
  "qué cualidades aparecen", "cómo eres ahora", "qué aparece en ti",
];
const STABILIZE_ASSISTANT = [
  "побудь в этом", "запомни это состояние", "дай этому состоянию", "как это ощущается сейчас", "позволь этому состоянию",
  "останься в этом", "почувствуй эту опору", "quédate un momento", "deja que este estado", "cómo se siente ahora",
];
const INTEGRATION_ASSISTANT = [
  "привнести в свою жизнь", "применять в жизни", "как изменилась бы твоя жизнь", "что бы ты начала делать", "что бы ты начал делать",
  "как бы ты смотрела", "как бы ты смотрел", "где в жизни", "в реальной жизни", "что изменится в твоей жизни",
  "llevar esto a tu vida", "qué cambiaría en tu vida", "qué harías diferente", "en tu vida real",
];

const REFUSAL = ["не хочу", "не могу", "не получается", "не чувствую", "не знаю", "стоп", "хватит", "no quiero", "no puedo", "no sé"];
const BIG_U_QUALITY_HINTS = [
  "красивая", "красивый", "красиво", "уверенн", "центрирован", "опор", "устойчив", "равновес", "ясн", "сильн",
  "свобод", "спокойн", "цельн", "целост", "зрел", "жив", "ярк", "достоин", "ценн", "собран", "мощн",
  "segur", "centrad", "estable", "fuerte", "libre", "tranquil", "clar", "viva", "valiosa", "equilibr",
];

function primaryProfile(userText) {
  const dimensions = [];
  if (hasAny(userText, LOCALIZATION)) dimensions.push("localization");
  if (hasAny(userText, QUALITY)) dimensions.push("quality");
  if (hasAny(userText, IMPACT)) dimensions.push("impact");
  if (hasAny(userText, TEMPORAL)) dimensions.push("temporal");
  if (hasAny(userText, CONTEXT)) dimensions.push("context");
  const livedPattern = dimensions.some((d) => ["impact", "temporal", "context"].includes(d));
  return { dimensions, sufficient: dimensions.length >= 3 && livedPattern };
}

function detectXChannel(userText) {
  if (hasAny(userText, X_VISUAL)) return "visual";
  if (hasAny(userText, X_AUDITORY)) return "auditory";
  if (hasAny(userText, X_MOVEMENT)) return "movement";
  if (hasAny(userText, X_SENSATION)) return "proprioceptive";
  return null;
}

function lastAssistantIndex(messages, markers) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const lower = String(messages[i].content || "").toLowerCase();
    if (hasAny(lower, markers)) return i;
  }
  return -1;
}

function userResponseAfter(messages, markers) {
  const idx = lastAssistantIndex(messages, markers);
  if (idx < 0) return null;
  const reply = messages.slice(idx + 1).find((m) => m.role === "user");
  if (!reply) return null;
  const text = String(reply.content || "").trim();
  if (!text || hasAny(text.toLowerCase(), REFUSAL)) return null;
  return text;
}

function latestUserSummary(messages) {
  return userMessages(messages)
    .slice(-10)
    .map((m) => String(m.content || "").trim())
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1200);
}

export function detectBodyProcessStage(messages) {
  const users = userMessages(messages);
  const userText = textOf(users);
  const profile = primaryProfile(userText);
  const hasSignal = hasAny(userText, SIGNAL);

  // A spontaneous X may appear before the primary profile is complete (e.g. "как каменная плита").
  // We remember it, but we do not advance to X work until small u is sufficiently described.
  const xChannel = detectXChannel(userText);

  const identificationReply = userResponseAfter(messages, IDENTIFICATION_ASSISTANT);
  const unfoldReply = userResponseAfter(messages, UNFOLD_ASSISTANT);
  const bigUReply = userResponseAfter(messages, BIG_U_ASSISTANT);
  const stabilizeReply = userResponseAfter(messages, STABILIZE_ASSISTANT);
  const integrationReply = userResponseAfter(messages, INTEGRATION_ASSISTANT);

  const xIdentified = !!identificationReply;
  const xUnfolded = !!unfoldReply || (xIdentified && hasAny(identificationReply.toLowerCase(), ["мне хочется", "я двига", "я дыш", "я звуч", "я стою", "я лежу", "я сия", "я блест", "я чувствую себя", "me apetece", "respiro", "me siento"]));
  const bigU = !!bigUReply || (xUnfolded && hasAny(String(unfoldReply || identificationReply || "").toLowerCase(), BIG_U_QUALITY_HINTS));
  const stabilized = bigU && !!stabilizeReply;
  const integrated = stabilized && !!integrationReply;
  const summary = latestUserSummary(messages);

  const base = {
    primary_answer: profile.sufficient ? summary : null,
    secondary_answer: bigU ? String(bigUReply || unfoldReply || identificationReply || "").slice(0, 500) : null,
    dream_shared: true,
    body_primary_dimensions: profile.dimensions,
    x_channel: xChannel,
    x_identified: xIdentified,
    x_unfolded: xUnfolded,
    big_u_emerged: bigU,
    big_u_stabilized: stabilized,
    integration_material: integrated ? integrationReply : null,
    focus_locked: !!xChannel && profile.sufficient,
    exploration_active: xIdentified || xUnfolded || bigU,
    current_process_target: xChannel && profile.sufficient ? `X energy (${xChannel} channel)` : null,
  };

  if (!hasSignal) return { stage: "awaiting_body_signal", ...base };
  if (!profile.sufficient) return { stage: "body_small_u", ...base };
  if (!xChannel) return { stage: "body_amplify_signal", ...base };
  if (!xIdentified) return { stage: "body_identify_x", ...base };
  if (!xUnfolded) return { stage: "body_unfold_x", ...base };
  if (!bigU) return { stage: "body_discover_big_u", ...base };
  if (!stabilized) return { stage: "body_stabilize_big_u", ...base };
  if (!integrated) return { stage: "body_integrate_big_u", ...base };
  return { stage: "complete", ...base };
}

function nextPrimaryQuestion(dimensions, language) {
  const has = new Set(dimensions || []);
  const es = language === "es";
  if (!has.has("localization")) return es
    ? "¿Dónde exactamente notas esta señal en el cuerpo?"
    : "Где именно в теле ты замечаешь этот сигнал?";
  if (!has.has("quality")) return es
    ? "¿Cómo se siente exactamente desde dentro? ¿Qué cualidad tiene?"
    : "Как именно это ощущается изнутри? Какое у этого качество?";
  if (!has.has("impact")) return es
    ? "Cuando aparece, ¿cómo lo vives normalmente? ¿Qué te apetece hacer o evitar y qué cambia en tu percepción o actividad?"
    : "Когда это появляется, как ты обычно это проживаешь? Что хочется делать или не делать и что меняется в восприятии или активности?";
  if (!has.has("temporal")) return es
    ? "¿Desde cuándo te ocurre y con qué frecuencia suele aparecer?"
    : "Как давно это у тебя бывает и как часто обычно случается?";
  if (!has.has("context")) return es
    ? "Sin buscar una causa médica: ¿has notado en qué momentos o después de qué situaciones suele aparecer?"
    : "Не пытаясь искать медицинскую причину: замечаешь ли ты, в какие моменты или после каких ситуаций это обычно появляется?";
  return es
    ? "¿Qué más forma parte de tu manera habitual de vivir esta señal corporal?"
    : "Что ещё входит в твой привычный способ проживать этот телесный сигнал?";
}

export function buildBodyStageInstruction(stage, language = "ru") {
  const es = language === "es";
  const boundary = es
    ? "\nLÍMITE MÉDICO: no diagnostiques, no propongas causas médicas, no confirmes ni refutes explicaciones médicas y no des recomendaciones médicas. Explora únicamente la experiencia subjetiva y patrones observables."
    : "\nМЕДИЦИНСКАЯ ГРАНИЦА: не ставь диагнозы, не предполагай медицинские причины, не подтверждай и не опровергай медицинские версии и не давай медицинских рекомендаций. Исследуй только субъективное переживание и наблюдаемые паттерны.";

  if (stage.stage === "awaiting_body_signal") {
    const q = es ? "¿Qué señal corporal quieres explorar ahora?" : "Какой телесный сигнал ты хочешь сейчас исследовать?";
    return `\n\n🔴 BODY: СИМПТОМ / ТЕЛЕСНЫЙ СИГНАЛ\nЗадай ровно один вопрос: «${q}»${boundary}`;
  }
  if (stage.stage === "body_small_u") {
    const q = nextPrimaryQuestion(stage.body_primary_dimensions, language);
    return `\n\n🔴 BODY: МАЛОЕ u — ПЕРВИЧНЫЙ ПРОЦЕСС\nПодробно проявляй привычный способ человека проживать симптом: локализацию, качество, влияние на обычную жизнь/поведение, временной рисунок и наблюдаемый ситуационный контекст. Это НЕ поиск причин.\nУже собраны: ${(stage.body_primary_dimensions || []).join(", ") || "только исходный сигнал"}.\nЗадай РОВНО ОДИН следующий вопрос: «${q}»\nДаже если X/образ уже спонтанно появился, запомни его, но не разворачивай до достаточного проявления малого u.${boundary}`;
  }
  if (stage.stage === "body_amplify_signal") {
    return `\n\n🟠 BODY: АМПЛИФИКАЦИЯ СИГНАЛА → ПОИСК X\nМалое u достаточно проявлено. Теперь мягко усиливай сам телесный сигнал и следуй каналу, который возникает САМ. X может проявиться визуально, аудиально, через движение/позу или проприоцептивно. Не требуй образа и не навязывай канал. Задай один экспериментальный вопрос: что становится заметнее, если дать самому сигналу проявиться чуть отчётливее? Не интерпретируй.${boundary}`;
  }
  if (stage.stage === "body_identify_x") {
    return `\n\n🟠 BODY: X ОБНАРУЖЕН (${stage.x_channel}) → ИДЕНТИФИКАЦИЯ С X\nX — отщеплённая энергия, но ещё НЕ вторичный процесс. Предложи человеку на короткое время СТАТЬ этим конкретным X, используя его точные слова. Если X — плита, человек становится плитой; если звук — становится/звучит этим звуком; если движение — позволяет телу войти в это движение. Задай один вопрос о непосредственном переживании изнутри X. Не спрашивай смысл и не интегрируй.${boundary}`;
  }
  if (stage.stage === "body_unfold_x") {
    return `\n\n🟠 BODY: РАЗВОРАЧИВАНИЕ X\nЧеловек уже вошёл в X. Теперь дай X пожить и развернуться в активном канале. Можно двигаться или оставаться неподвижно, дышать, звучать, занимать пространство, менять позу, сиять, красоваться — только если это естественно следует из переживания. Движется/дышит/звучит КЛИЕНТ КАК X, а не внешний объект сам по себе. Задай ровно один экспериментальный вопрос. Не переходи к жизни.${boundary}`;
  }
  if (stage.stage === "body_discover_big_u") {
    return `\n\n🟢 BODY: ОБНАРУЖЕНИЕ БОЛЬШОГО U — ВТОРИЧНОГО ПРОЦЕССА\nX уже достаточно прожит. Теперь спроси, КАКИМ человеком клиент становится, когда эта энергия возвращена: какие качества, состояние, способ присутствовать появляются? Не подсказывай качества и не интерпретируй. Большое U, а не X, является вторичным процессом. Задай один вопрос.${boundary}`;
  }
  if (stage.stage === "body_stabilize_big_u") {
    return `\n\n🟢 BODY: ЗАКРЕПЛЕНИЕ БОЛЬШОГО U\nБольшое U проявилось. Не спеши в анализ жизни. Помоги несколько мгновений пожить в этом состоянии: как оно ощущается в теле, позе, дыхании, присутствии; что помогает его удерживать и узнавать. Используй точные качества клиента. Задай один вопрос на стабилизацию.${boundary}`;
  }
  if (stage.stage === "body_integrate_big_u") {
    return `\n\n🔵 BODY: ИНТЕГРАЦИЯ БОЛЬШОГО U В ЖИЗНЬ\nТеперь интегрируй именно качества большого U: как их можно привнести в жизнь, что изменится, что человек начнёт делать иначе, как из этого состояния выглядят старые проблемы/отношения/решения. Задавай один вопрос за раз и опирайся на точные качества, названные клиентом. Не возвращайся к поиску причины симптома.${boundary}`;
  }
  return "";
}
