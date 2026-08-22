// Dedicated Body-mode Process Work state machine.
// Architecture: symptom -> small u (primary process) -> amplification -> X image -> identification with X
// -> unfolding X through one or more Process Work channels -> big U (secondary process) -> stabilization -> integration.
// IMPORTANT: X is an image/figure/form carrying disowned energy. The image may be perceived/unfolded through ANY of
// the six Process Work channels: visual, proprioceptive, auditory, relationship, movement, world.
// X is NOT the secondary process. big U is the secondary process.

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

// X must first emerge as an IMAGE / FIGURE / FORM. It is deliberately separate from channel detection.
const IMAGE_USER = [
  "образ", "похоже на", "как будто это", "напоминает", "представляю", "видится", "выглядит как",
  "это как ", "словно ", "будто ", "форма", "фигура", "существо", "персонаж", "монстр", "камень", "каменн",
  "плита", "туман", "стена", "шар", "волна", "цветок", "рисунок", "imagen", "parece", "como si", "figura", "monstruo",
];
const IMAGE_ASSISTANT = [
  "какой образ", "каким образом", "в какой образ", "какую форму", "какая форма", "на что это похоже", "если бы это стало образом",
  "если бы у этого был образ", "если бы у этого была форма", "qué imagen", "qué forma", "a qué se parece", "si tuviera una imagen",
];

// Six Process Work channels. These are cues only; the authoritative definitions are loaded from the Term table
// by sessionAI and injected into the Body prompt. A single X can unfold through several channels.
const CHANNEL_SIGNALS = {
  visual: ["вижу", "выгляд", "цвет", "форма", "размер", "свет", "темн", "блест", "veo", "color", "forma", "brilla"],
  proprioceptive: ["ощущаю", "чувствую в теле", "давит", "тепло", "холод", "тяжесть", "вибр", "горит", "дышу как", "siento", "calor", "frío", "presión", "arde"],
  auditory: ["слышу", "звучит", "голос", "звук", "ритм", "крич", "шепч", "oigo", "suena", "voz", "sonido"],
  relationship: ["со мной", "ко мне", "на меня", "между нами", "кому-то", "с кем-то", "отношение", "контакт", "me mira", "conmigo", "entre nosotros", "relación"],
  movement: ["двига", "движ", "иду", "бегу", "толка", "тянет", "скруч", "поза", "жест", "me muevo", "camino", "empuja", "tira", "gesto"],
  world: ["мир", "пространство вокруг", "всё вокруг", "события", "случается вокруг", "окружение", "атмосфера", "погода", "мир отвечает", "mundo", "alrededor", "entorno", "atmósfera"],
};

const IDENTIFICATION_ASSISTANT = [
  "стань эт", "стать эт", "побудь эт", "если ты —", "если ты становишься", "если ты сейчас", "попробуй быть эт",
  "попробуй на мгновение стать", "войти в этот образ", "войти в эту", "войти в это ощущение", "представь, что ты —",
  "sé eso", "si tú eres", "si ahora eres", "conviértete en",
];
const UNFOLD_ASSISTANT = [
  "позволь этому образу", "позволь этому проявиться", "как этот образ проявляется", "как ты проявляешься как",
  "как тебе хочется двигаться", "как хочется двигаться", "как тебе хочется дышать", "как хочется дышать",
  "как тебе хочется звучать", "как хочется звучать", "что ты делаешь, когда ты", "как ты занимаешь пространство",
  "как это разворачивается", "cómo se manifiesta", "cómo te apetece moverte", "cómo respiras", "cómo suenas",
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
  "привнести", "применять в жизни", "как изменилась бы твоя жизнь", "что бы ты начала делать", "что бы ты начал делать",
  "как бы ты смотрела", "как бы ты смотрел", "где в жизни", "в реальной жизни", "что изменится в твоей жизни",
  "llevar esto", "qué cambiaría en tu vida", "qué harías diferente", "en tu vida real",
];

const REFUSAL = ["не хочу", "не могу", "не получается", "не чувствую", "не знаю", "стоп", "хватит", "no quiero", "no puedo", "no sé"];

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

function detectChannels(userText) {
  return Object.entries(CHANNEL_SIGNALS)
    .filter(([, signals]) => hasAny(userText, signals))
    .map(([channel]) => channel);
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

function detectImage(messages, userText) {
  const promptedImage = userResponseAfter(messages, IMAGE_ASSISTANT);
  if (promptedImage) return promptedImage;
  if (hasAny(userText, IMAGE_USER)) {
    const last = [...userMessages(messages)].reverse().find((m) => hasAny(String(m.content || "").toLowerCase(), IMAGE_USER));
    return last ? String(last.content || "").trim() : "image";
  }
  return null;
}

export function detectBodyProcessStage(messages) {
  const users = userMessages(messages);
  const userText = textOf(users);
  const profile = primaryProfile(userText);
  const hasSignal = hasAny(userText, SIGNAL);
  const xImage = detectImage(messages, userText);
  const channels = detectChannels(userText);

  const identificationReply = userResponseAfter(messages, IDENTIFICATION_ASSISTANT);
  const unfoldReply = userResponseAfter(messages, UNFOLD_ASSISTANT);
  const bigUReply = userResponseAfter(messages, BIG_U_ASSISTANT);
  const stabilizeReply = userResponseAfter(messages, STABILIZE_ASSISTANT);
  const integrationReply = userResponseAfter(messages, INTEGRATION_ASSISTANT);

  const xIdentified = !!identificationReply;
  const xUnfolded = !!unfoldReply;
  // big U only emerges after the explicit big-U question. Qualities appearing while X is still unfolding
  // remain properties of X until the client identifies how THEY are becoming.
  const bigU = !!bigUReply;
  const stabilized = bigU && !!stabilizeReply;
  const integrated = stabilized && !!integrationReply;
  const summary = latestUserSummary(messages);

  const base = {
    primary_answer: profile.sufficient ? summary : null,
    secondary_answer: bigU ? String(bigUReply).slice(0, 500) : null,
    dream_shared: true,
    body_primary_dimensions: profile.dimensions,
    x_image: xImage,
    x_image_emerged: !!xImage,
    x_channels: channels,
    x_channel: channels[0] || null,
    x_identified: xIdentified,
    x_unfolded: xUnfolded,
    big_u_emerged: bigU,
    big_u_stabilized: stabilized,
    integration_material: integrated ? integrationReply : null,
    focus_locked: !!xImage && profile.sufficient,
    exploration_active: xIdentified || xUnfolded || bigU,
    current_process_target: xImage && profile.sufficient ? `X image: ${String(xImage).slice(0, 180)}` : null,
  };

  if (!hasSignal) return { stage: "awaiting_body_signal", ...base };
  if (!profile.sufficient) return { stage: "body_small_u", ...base };
  if (!xImage) return { stage: "body_amplify_signal", ...base };
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

export function buildBodyStageInstruction(stage, language = "es") {
  const es = language === "es";
  const boundary = es
    ? "\nLÍMITE MÉDICO: no diagnostiques, no propongas causas médicas, no confirmes ni refutes explicaciones médicas y no des recomendaciones médicas. Explora únicamente la experiencia subjetiva y patrones observables."
    : "\nМЕДИЦИНСКАЯ ГРАНИЦА: не ставь диагнозы, не предполагай медицинские причины, не подтверждай и не опровергай медицинские версии и не давай медицинских рекомендаций. Исследуй только субъективное переживание и наблюдаемые паттерны.";
  const channels = es
    ? "Usa las definiciones cargadas desde la tabla Term. Los seis canales de Process Work son: visual, propioceptivo, auditivo, relación, movimiento y mundo."
    : "Используй определения, загруженные из таблицы Term. Шесть каналов Process Work: визуальный, проприоцептивный, аудиальный, канал отношений, канал движения и мировой канал.";

  if (stage.stage === "awaiting_body_signal") {
    const q = es ? "¿Qué señal corporal quieres explorar ahora?" : "Какой телесный сигнал ты хочешь сейчас исследовать?";
    return `\n\n🔴 BODY: СИМПТОМ / ТЕЛЕСНЫЙ СИГНАЛ\nЗадай ровно один вопрос: «${q}»${boundary}`;
  }
  if (stage.stage === "body_small_u") {
    const q = nextPrimaryQuestion(stage.body_primary_dimensions, language);
    return `\n\n🔴 BODY: МАЛОЕ u — ПЕРВИЧНЫЙ ПРОЦЕСС\nПодробно проявляй привычный способ человека проживать симптом: локализацию, качество, влияние на обычную жизнь/поведение, временной рисунок и наблюдаемый ситуационный контекст. Это НЕ поиск причин.\nУже собраны: ${(stage.body_primary_dimensions || []).join(", ") || "только исходный сигнал"}.\nЗадай РОВНО ОДИН следующий вопрос: «${q}»\nЕсли образ X уже спонтанно появился, запомни его, но не разворачивай до достаточного проявления малого u.${boundary}`;
  }
  if (stage.stage === "body_amplify_signal") {
    return `\n\n🟠 BODY: АМПЛИФИКАЦИЯ СИГНАЛА → ОБРАЗ X\nМалое u достаточно проявлено. Теперь амплифицируй телесный сигнал и помоги ему перейти в ОБРАЗ / ФИГУРУ / ФОРМУ X. Образ обязателен как следующий процессуальный ориентир. Не придумывай образ за клиента. Спроси одним экспериментальным вопросом, например: «Если дать этому ощущению стать чуть отчётливее — какой образ или форма начинает появляться, на что это похоже?»\n${channels}\nВАЖНО: канал — это не замена образу. Канал описывает, КАК человек воспринимает или разворачивает уже возникающий образ.${boundary}`;
  }
  if (stage.stage === "body_identify_x") {
    return `\n\n🟠 BODY: ОБРАЗ X ОБНАРУЖЕН → ИДЕНТИФИКАЦИЯ С X\nX — образ/фигура, несущая отщеплённую энергию, но ещё НЕ вторичный процесс. Предложи человеку на короткое время СТАТЬ этим конкретным образом, используя его точные слова. Если это монстр — стать монстром; если плита — стать плитой. Задай один вопрос о непосредственном переживании изнутри X.\n${channels}\nНе навязывай визуальность: человек может переживать один и тот же образ через любой из шести каналов — например видеть монстра, слышать его, дышать/гореть как он, двигаться как он, переживать его через отношения или через происходящее в мире.${boundary}`;
  }
  if (stage.stage === "body_unfold_x") {
    const detected = (stage.x_channels || []).length ? ` Уже проявились каналы: ${(stage.x_channels || []).join(", ")}.` : "";
    return `\n\n🟠 BODY: РАЗВОРАЧИВАНИЕ ОБРАЗА X ЧЕРЕЗ КАНАЛЫ\nЧеловек уже вошёл в образ X. Теперь дай этому образу пожить и развернуться. ${channels}${detected}\nСледуй тому каналу, который реально проявляется у клиента, и при необходимости замечай смену/усиление другого канала. Не ограничивайся визуальным, телесным или движением. Доступны ВСЕ ШЕСТЬ каналов. Движется, звучит, дышит, смотрит, вступает в отношение или переживает мировой отклик КЛИЕНТ КАК X. Задай ровно один экспериментальный вопрос. Не переходи к смыслу и к жизни.${boundary}`;
  }
  if (stage.stage === "body_discover_big_u") {
    return `\n\n🟢 BODY: ОБНАРУЖЕНИЕ БОЛЬШОГО U — ВТОРИЧНОГО ПРОЦЕССА\nОбраз X уже достаточно прожит через доступные каналы. Теперь спроси, КАКИМ человеком клиент становится, когда эта энергия возвращена: какие качества, состояние, способ присутствовать появляются? Не подсказывай качества и не интерпретируй. Большое U, а не образ X и не канал, является вторичным процессом. Задай один вопрос.${boundary}`;
  }
  if (stage.stage === "body_stabilize_big_u") {
    return `\n\n🟢 BODY: ЗАКРЕПЛЕНИЕ БОЛЬШОГО U\nБольшое U проявилось. Не спеши в анализ жизни. Помоги несколько мгновений пожить в этом состоянии: как оно ощущается в теле, позе, дыхании, присутствии; что помогает его удерживать и узнавать. Используй точные качества клиента. Задай один вопрос на стабилизацию.${boundary}`;
  }
  if (stage.stage === "body_integrate_big_u") {
    return `\n\n🔵 BODY: ИНТЕГРАЦИЯ БОЛЬШОГО U В ЖИЗНЬ\nТеперь интегрируй именно качества большого U: как их можно привнести в жизнь, что изменится, что человек начнёт делать иначе, как из этого состояния выглядят старые проблемы/отношения/решения. Задавай один вопрос за раз и опирайся на точные качества, названные клиентом. Не возвращайся к поиску причины симптома.${boundary}`;
  }
  return "";
}
