// Body-mode Process Work state machine.
// Architecture: symptom -> small u (primary process) -> amplify signal -> X -> identify with X
// -> unfold X across the active channel -> big U (secondary process) -> stabilize -> integrate.
// IMPORTANT: X is NOT the secondary process. big U is the secondary process that emerges
// when the disowned X-energy is lived and its qualities become available to the person.

const USER = (messages) => messages.filter((m) => m.role === "user");
const ASSISTANT = (messages) => messages.filter((m) => m.role === "assistant");
const textOf = (items) => items.map((m) => String(m.content || "").toLowerCase()).join(" ");
const hasAny = (text, signals) => signals.some((s) => text.includes(s));

const SIGNAL = ["боль", "болит", "чеш", "зуд", "напряж", "давлен", "сжати", "тяжест", "пульсац", "спазм", "жжен", "онем", "дрож", "ощущ", "симптом", "устал", "dolor", "picor", "tensión", "presión", "sensación", "síntoma"];
const LOCALIZATION = ["в голове", "в груди", "в животе", "в спине", "в шее", "в плеч", "в рук", "в ног", "в глаз", "в виск", "в лбу", "в макуш", "мизин", "слева", "справа", "где именно"];
const QUALITY = ["давлен", "сжати", "тяжест", "пульсац", "жжен", "остр", "туп", "ноющ", "колет", "чеш", "зуд", "твёрд", "тверд", "мягк", "горяч", "холод", "вибрац"];
const IMPACT = ["хочется лечь", "хочу лечь", "лежать", "закрываются глаза", "закрыть глаза", "глушит", "ослепляет", "яркий свет", "не нравится шум", "мешает шум", "хочется тишины", "не могу смотреть", "не могу слушать", "мешает", "трудно", "не хочется двиг", "хочется двиг"];
const TEMPORAL = ["давно", "недавно", "часто", "редко", "иногда", "каждый", "раз в", "началось", "начинается", "случается", "обычно", "утром", "вечером", "ночью", "час", "день", "недел", "месяц", "год"];
const CONTEXT = ["после ", "когда ", "если ", "недосып", "не высп", "сон", "работ", "нагруз", "стресс", "бег", "спорт", "трениров", "еда", "цикл", "дорог", "экран", "ссор", "разговор"];

// X may emerge in any channel. Do not privilege visual imagery.
const X_VISUAL = ["образ", "похоже на", "как будто", "напоминает", "вижу", "представля", "цвет", "форма", "камень", "каменн", "плита", "туман", "огонь", "вода", "свет", "существо"];
const X_AUDITORY = ["звук", "звучит", "голос", "шум", "гул", "писк", "звон", "ритм", "слово", "фраза"];
const X_MOVEMENT = ["движ", "тянет", "толкает", "сжимается", "расширяется", "поднимается", "опускается", "скруч", "замира", "неподвиж"];
const X_SENSATION = ["становится сильнее", "усиливается", "нарастает", "распространяется", "меняет форму", "меняется", "интенсивнее"];

const IDENTIFICATION_ASSISTANT = ["стань этим", "побудь этим", "если ты —", "если ты становишься", "изнутри этого", "войти в этот образ", "войти в это ощущение", "sé eso", "si tú eres"];
const UNFOLDING_USER = ["я как", "я —", "я становлюсь", "мне хочется", "я двигаюсь", "я не двигаюсь", "я дышу", "я говорю", "я звучу", "я занимаю", "я сияю", "я блест", "я стою", "я лежу", "я расправ", "я чувствую себя"];
const BIG_U_QUALITIES = ["красивая", "красивый", "красиво", "уверенн", "центрирован", "опор", "устойчив", "равновес", "ясн", "сильн", "свобод", "спокойн", "цельн", "целост", "зрел", "жив", "ярк", "достоин", "ценн", "присутств", "в теле", "собран", "мощн"];
const STABILIZE_ASSISTANT = ["побудь в этом", "запомни это состояние", "дай этому состоянию", "как это ощущается сейчас", "что меняется в тебе", "позволь этому", "останься в этом"];
const INTEGRATION_ASSISTANT = ["привнести в свою жизнь", "применять в жизни", "как изменилась бы твоя жизнь", "что бы ты начала делать", "что бы ты начал делать", "как бы ты смотрела", "как бы ты смотрел", "где в жизни", "в реальной жизни"];
const INTEGRATION_USER = ["в жизни я", "я могла бы", "я мог бы", "я начну", "я бы начала", "я бы начал", "изменилось бы", "я буду", "в отношениях", "в работе"];

function primaryProfile(userText) {
  const dimensions = [];
  if (hasAny(userText, LOCALIZATION)) dimensions.push("localization");
  if (hasAny(userText, QUALITY)) dimensions.push("quality");
  if (hasAny(userText, IMPACT)) dimensions.push("impact");
  if (hasAny(userText, TEMPORAL)) dimensions.push("temporal");
  if (hasAny(userText, CONTEXT)) dimensions.push("context");
  // Primary process must include the lived-life pattern, not only location + quality.
  const lived = dimensions.some((d) => ["impact", "temporal", "context"].includes(d));
  return { dimensions, sufficient: dimensions.length >= 3 && lived };
}

function detectXChannel(userText) {
  if (hasAny(userText, X_VISUAL)) return "visual";
  if (hasAny(userText, X_AUDITORY)) return "auditory";
  if (hasAny(userText, X_MOVEMENT)) return "movement";
  if (hasAny(userText, X_SENSATION)) return "proprioceptive";
  return null;
}

export function detectBodyProcessStage(messages) {
  const users = USER(messages);
  const assistants = ASSISTANT(messages);
  const userText = textOf(users);
  const assistantText = textOf(assistants);
  const profile = primaryProfile(userText);
  const xChannel = detectXChannel(userText);
  const hasSignal = hasAny(userText, SIGNAL);
  const identified = hasAny(assistantText, IDENTIFICATION_ASSISTANT) && users.length > 1;
  const unfolded = identified && hasAny(userText, UNFOLDING_USER);
  const bigU = unfolded && hasAny(userText, BIG_U_QUALITIES);
  const stabilized = bigU && hasAny(assistantText, STABILIZE_ASSISTANT);
  const integrationAsked = bigU && hasAny(assistantText, INTEGRATION_ASSISTANT);
  const integrated = integrationAsked && hasAny(userText, INTEGRATION_USER);
  const summary = users.slice(-8).map((m) => String(m.content || "").trim()).filter(Boolean).join(" | ").slice(0, 1000);

  const base = {
    primary_answer: profile.sufficient ? summary : null,
    secondary_answer: bigU ? "big U qualities emerged from lived X" : null,
    dream_shared: true,
    body_primary_dimensions: profile.dimensions,
    x_channel: xChannel,
    x_identified: identified,
    x_unfolded: unfolded,
    big_u_emerged: bigU,
    big_u_stabilized: stabilized,
    integration_material: integrated ? summary : null,
    focus_locked: !!xChannel,
    exploration_active: identified || unfolded || bigU,
    current_process_target: xChannel ? "X energy in active channel" : null,
  };

  if (!hasSignal) return { stage: "awaiting_body_signal", ...base };
  if (!profile.sufficient) return { stage: "body_small_u", ...base };
  if (!xChannel) return { stage: "body_amplify_signal", ...base };
  if (!identified) return { stage: "body_identify_x", ...base };
  if (!unfolded) return { stage: "body_unfold_x", ...base };
  if (!bigU) return { stage: "body_discover_big_u", ...base };
  if (!stabilized && !integrationAsked) return { stage: "body_stabilize_big_u", ...base };
  if (!integrated) return { stage: "body_integrate_big_u", ...base };
  return { stage: "complete", ...base };
}

function nextPrimaryQuestion(profile, language) {
  const has = new Set(profile || []);
  const es = language === "es";
  if (!has.has("localization")) return es ? "¿Dónde exactamente notas esta señal en el cuerpo?" : "Где именно в теле ты замечаешь этот сигнал?";
  if (!has.has("quality")) return es ? "¿Cómo se siente exactamente desde dentro?" : "Как именно это ощущается изнутри? Какое у этого качество?";
  if (!has.has("impact")) return es ? "Cuando aparece, ¿cómo lo vives normalmente? ¿Qué te apetece hacer o evitar; qué cambia en tu atención, movimiento, luz o sonidos?" : "Когда это появляется, как ты обычно это проживаешь? Что хочется делать или не делать; что меняется во внимании, движении, восприятии света или звуков?";
  if (!has.has("temporal")) return es ? "¿Desde cuándo te ocurre y con qué frecuencia suele aparecer?" : "Как давно это у тебя бывает и как часто обычно случается?";
  if (!has.has("context")) return es ? "Sin buscar una explicación médica: ¿has notado en qué momentos o después de qué situaciones suele aparecer?" : "Не пытаясь объяснять это медицински: замечаешь ли ты, в какие моменты или после каких ситуаций это обычно появляется?";
  return es ? "¿Qué más forma parte de tu manera habitual de vivir esta señal corporal?" : "Что ещё входит в твой привычный способ проживать этот телесный сигнал?";
}

export function buildBodyStageInstruction(stage, language = "ru") {
  const es = language === "es";
  const boundary = `\nМЕДИЦИНСКАЯ ГРАНИЦА: не ставь диагноз, не предполагай причину болезни, не подтверждай/опровергай медицинские версии и не давай медицинских рекомендаций. Мы исследуем субъективное переживание и наблюдаемые паттерны. Не спрашивай «почему это началось?»; можно спрашивать «когда/как часто/после каких ситуаций ты сама это замечаешь?».`;

  if (stage.stage === "awaiting_body_signal") return `\n\n🔴 BODY: СИМПТОМ / ТЕЛЕСНЫЙ СИГНАЛ\nЗадай один вопрос: «${es ? "¿Qué señal corporal quieres explorar ahora?" : "Какой телесный сигнал ты хочешь сейчас исследовать?"}»${boundary}`;
  if (stage.stage === "body_small_u") return `\n\n🔴 BODY: МАЛОЕ u — ПЕРВИЧНЫЙ ПРОЦЕСС\nСначала подробно прояви привычный способ человека проживать симптом. Это НЕ поиск причины. Уже собраны: ${stage.body_primary_dimensions.join(", ") || "только исходный сигнал"}.\nЗадай РОВНО ОДИН следующий вопрос: «${nextPrimaryQuestion(stage.body_primary_dimensions, language)}»\nНе переходи к X, образу, амплификации или вторичному процессу, пока первичный процесс не проявлен достаточно.${boundary}`;
  if (stage.stage === "body_amplify_signal") return `\n\n🟠 BODY: АМПЛИФИКАЦИЯ СИГНАЛА → ПОИСК X\nМалое u достаточно проявлено. Теперь мягко усиливай/уточняй сам телесный сигнал и СЛЕДУЙ КАНАЛУ, который возникает у человека сам. X может проявиться как образ, звук/голос, движение/поза или чистое телесное качество. НЕ требуй визуального образа. Задай один экспериментальный вопрос, позволяющий сигналу стать чуть отчётливее, и спроси, что появляется само. Не интерпретируй.${boundary}`;
  if (stage.stage === "body_identify_x") return `\n\n🟠 BODY: X ОБНАРУЖЕН (${stage.x_channel}) → ИДЕНТИФИКАЦИЯ С X\nX — отщеплённая энергия/часть, но ЕЩЁ НЕ вторичный процесс. Не анализируй X со стороны. Предложи человеку НА МГНОВЕНИЕ СТАТЬ этим X и пережить его изнутри. Если это образ — стать образом; если звук — звучать им; если движение — позволить телу принять его; если ощущение — полностью занять его качество. Один вопрос/эксперимент. Не спрашивай, куда хочет двигаться внешний объект.${boundary}`;
  if (stage.stage === "body_unfold_x") return `\n\n🟠 BODY: РАЗВОРАЧИВАНИЕ X\nЧеловек уже идентифицируется с X. Помоги X развернуться через активный канал и при необходимости сменить канал: движение/неподвижность самого человека, поза, дыхание, звук, голос, визуальные свойства, пространство. Не заставляй объект двигаться: двигается/дышит/звучит КЛИЕНТ, будучи X. Задавай по одному вопросу и оставайся в непосредственном опыте.${boundary}`;
  if (stage.stage === "body_discover_big_u") return `\n\n🟢 BODY: ОБНАРУЖЕНИЕ БОЛЬШОГО U — ВТОРИЧНОГО ПРОЦЕССА\nX уже достаточно прожит. Теперь спроси о КАЧЕСТВАХ СОСТОЯНИЯ, которые становятся доступны человеку, когда он является X: «Какая ты здесь? Как ты себя чувствуешь, когда полностью являешься этим?» Не предлагай готовые качества и не интерпретируй. Именно возникающие качества расширенной идентичности = большое U / вторичный процесс.${boundary}`;
  if (stage.stage === "body_stabilize_big_u") return `\n\n🟢 BODY: ЗАКРЕПЛЕНИЕ БОЛЬШОГО U\nБольшое U уже проявилось. Не возвращайся к симптому и не ищи новый X. Помоги человеку телесно побыть в новом состоянии и сделать его узнаваемым: поза, дыхание, ощущение опоры, пространство, способ смотреть/стоять/звучать — только то, что естественно следует из слов пользователя. Один вопрос.${boundary}`;
  if (stage.stage === "body_integrate_big_u") return `\n\n🟢 BODY: ИНТЕГРАЦИЯ БОЛЬШОГО U В ЖИЗНЬ\nРаботай ТОЛЬКО с уже названными человеком качествами большого U. Задай один конкретный вопрос интеграции: как эти качества можно привнести в жизнь; что изменится; что человек начнёт делать иначе; как из этого состояния выглядят старые проблемы. Не возвращайся к X ради нового исследования. После достаточной интеграции можно завершать.${boundary}`;
  return "";
}
