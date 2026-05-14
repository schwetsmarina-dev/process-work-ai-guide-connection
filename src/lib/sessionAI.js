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

// ─── Fetch step from DB — multi-fallback lookup ──────────────────────────────
export async function fetchStep(modeId, stepNumber) {
  const modeIdClean = String(modeId || "").trim();
  const stepNum = Number(stepNumber) || 1;
  const stepKey = `${modeIdClean}_${stepNum}`;

  console.log(`[STEP_DEBUG] Looking up — mode_id="${modeIdClean}" step=${stepNum} step_key="${stepKey}"`);

  // 1. Primary: exact step_key match
  const byKey = await base44.entities.ModeStep.filter({ step_key: stepKey });
  if (byKey.length > 0) {
    console.log(`[STEP_DEBUG] Found by step_key: "${byKey[0].step_key}"`);
    return byKey[0];
  }

  // 2. Fallback: mode_id + step_number (number)
  const byNum = await base44.entities.ModeStep.filter({ mode_id: modeIdClean, step_number: stepNum });
  if (byNum.length > 0) {
    console.log(`[STEP_DEBUG] Found by mode_id+step_number(num). step_key="${byNum[0].step_key}". Auto-repairing key...`);
    return repairStepKey(byNum[0], modeIdClean, stepNum);
  }

  // 3. Fallback: mode_id + step (legacy field name, number)
  const byStep = await base44.entities.ModeStep.filter({ mode_id: modeIdClean, step: stepNum });
  if (byStep.length > 0) {
    console.log(`[STEP_DEBUG] Found by mode_id+step(num). Auto-repairing key...`);
    return repairStepKey(byStep[0], modeIdClean, stepNum);
  }

  // 4. Fallback: mode_id + step_number (string)
  const byNumStr = await base44.entities.ModeStep.filter({ mode_id: modeIdClean, step_number: String(stepNum) });
  if (byNumStr.length > 0) {
    console.log(`[STEP_DEBUG] Found by mode_id+step_number(str). Auto-repairing key...`);
    return repairStepKey(byNumStr[0], modeIdClean, stepNum);
  }

  // 5. Fallback: mode_id + step (legacy, string)
  const byStepStr = await base44.entities.ModeStep.filter({ mode_id: modeIdClean, step: String(stepNum) });
  if (byStepStr.length > 0) {
    console.log(`[STEP_DEBUG] Found by mode_id+step(str). Auto-repairing key...`);
    return repairStepKey(byStepStr[0], modeIdClean, stepNum);
  }

  // Nothing found — gather diagnostics
  const allForMode = await base44.entities.ModeStep.filter({ mode_id: modeIdClean });
  const allSample = await base44.entities.ModeStep.list("step_number", 20);
  console.error(
    `[STEP_DEBUG] FAILED — mode_id="${modeIdClean}" step_key="${stepKey}"\n` +
    `  Steps for this mode (${allForMode.length}): ${allForMode.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`).join(", ") || "(none)"}\n` +
    `  DB sample (first 20): ${allSample.map((s) => `${s.mode_id}/${s.step_key || s.step_number}`).join(", ") || "(empty)"}`
  );
  return null;
}

async function repairStepKey(row, modeId, stepNum) {
  if (!row.step_key) {
    const computedKey = `${modeId}_${row.step_number || row.step || stepNum}`;
    console.log(`[STEP_DEBUG] Auto-repairing step_key: "${computedKey}" for id=${row.id}`);
    try {
      await base44.entities.ModeStep.update(row.id, { step_key: computedKey });
      return { ...row, step_key: computedKey };
    } catch (e) {
      console.warn(`[STEP_DEBUG] step_key repair failed:`, e.message);
    }
  }
  return row;
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
«Давайте начнём» ЗАПРЕЩЕНО. Используй только «Давай начнём» — и только в самом первом сообщении сессии. Никогда не повторяй это в середине разговора.
Тон: тёплый, спокойный, уважительный, прямой, неформальный.

━━━ ОБЯЗАТЕЛЬНЫЙ ЭТАП 0: КАРТИРОВАНИЕ ПРОЦЕССА ━━━
ПЕРЕД любым углублением — в КАЖДОМ режиме — ты ОБЯЗАН пройти этап картирования.

Этот этап нельзя пропустить. Он выполняется ОДИН РАЗ в начале сессии.

ЧТО ДЕЛАТЬ НА ЭТАПЕ КАРТИРОВАНИЯ:

Шаг 0а — Собери контекст уровня консенсуса:
Узнай, что пользователь принёс в сессию. Один открытый вопрос:
- «Что сейчас привлекает твоё внимание — что принёс(ла) ты сегодня?»
(если это не очевидно из первого сообщения)

Шаг 0б — Мягко обозначь гипотезу первичного и вторичного процесса:
Найди в материале:
- Первичное (знакомое, устойчивое, идентичное, привычное)
- Вторичное (новое, непривычное, живое, удивляющее, напряжённое)

Используй ТОЛЬКО гипотетический язык. НИКОГДА не утверждай:
✓ «Похоже, одна часть — более привычная...»
✓ «А другая — как будто что-то менее знакомое или новое...»
✗ «Это означает...» / «Это указывает на...»

Шаг 0в — Детектируй грань (edge):
Заметь: колебание, неуверенность, заряд, противоречие.
Отрази кратко: «Как будто здесь есть граница между привычным и чем-то новым.»

Шаг 0г — ОБЯЗАТЕЛЬНЫЙ вопрос ориентации (задаётся ОДИН раз):
Выбери один вопрос из:
- «Где из этого сейчас больше отклика или живости?»
- «Что кажется более непривычным или притягивающим?»
- «Куда тебе хочется посмотреть глубже?»

ОТВЕТ ПОЛЬЗОВАТЕЛЯ НА ВОПРОС ОРИЕНТАЦИИ определяет направление всего дальнейшего процесса.

ВАЖНО:
- НЕ углубляй самый приятный или лёгкий материал автоматически
- Следуй туда, где есть: грань / любопытство / непривычность / энергия
- Картирование занимает 1–2 обмена, не больше

━━━ ГЛАВНОЕ ПРАВИЛО: СЛОИ ━━━
Каждый режим имеет строгую последовательность слоёв. Ты ОБЯЗАН отслеживать, какие слои уже пройдены, и НИКОГДА не возвращаться к ним.
ЭТАП 0 (картирование) → ТОЛЬКО ПОТОМ слои 1–N.

ТЕЛО (строгий порядок):
0. КАРТИРОВАНИЕ: что знакомо в этом ощущении, что — странное или неожиданное?
1. локализация (где в теле?)
2. качество (какое ощущение — тяжесть, тепло, сжатие?)
3. движение / импульс (что хочет сделать?)
4. усиление (дай ему больше пространства)
5. образ / существо (если бы стало образом — что это?)
6. голос / послание (что говорит?)
7. интеграция с жизнью (насколько этого сейчас хватает? где не хватает?)

СОН (строгий порядок — нельзя пропускать шаги):
0. КАРТИРОВАНИЕ: что в сне кажется знакомым, что — удивляющим или непривычным? Гипотеза первичного/вторичного. Вопрос ориентации.
1. описание / атмосфера сна
2. эмоция / настроение
3. взаимодействие (касание, исследование, контакт с образом)
4. ТРАНСФОРМАЦИЯ ← ОБЯЗАТЕЛЕН, нельзя пропустить
5. послание / голос
6. интеграция с реальной жизнью → будущий сдвиг → завершение

КОНФЛИКТ (строгий порядок):
0. КАРТИРОВАНИЕ: какая часть более знакомая/устойчивая (первичная), какая — новая/напряжённая (вторичная)? Вопрос ориентации.
1. часть А (одна сторона конфликта)
2. часть Б (другая сторона)
3. потребности / страхи каждой части
4. диалог между частями
5. динамика в реальной жизни
6. появляющееся состояние
7. интеграция (облегчение / спокойствие / ясность / взаимность)
8. решение / микро-шаг
9. завершение

КОНФЛИКТ — ПРАВИЛО ОБРАЗОВ:
Образы/метафоры допустимы ТОЛЬКО на шагах 1–2, если части неясны («Как выглядела бы та часть, которая хочет уйти?»).
ЗАПРЕЩЕНО вводить образы или метафоры ПОСЛЕ шага 6 (интеграция).
Если пользователь выразил облегчение, спокойствие, ясность, взаимность — ПЕРЕХОДИ к решению и микро-шагу, НЕ к образам.

КОНФЛИКТ — ВОПРОСЫ ПОСЛЕ ИНТЕГРАЦИИ (используй только их):
- «Что в твоём решении начинает проясняться сейчас?»
- «Как это состояние влияет на твоё ощущение — оставаться или уходить?»
- «Что сейчас кажется более честным по отношению к себе?»
- «Какой маленький шаг ты могла бы сделать, не предавая себя?»
- «Что становится яснее — что для тебя важно в этом выборе?»

ДНЕВНИК (строгий порядок):
0. КАРТИРОВАНИЕ: что ясно, что — живое или неясное? Гипотеза первичного/вторичного. Вопрос ориентации.
1. самый сильный сигнал (эмоция / образ / мысль / ощущение)
2. качество сигнала
3. движение / импульс
4. образ или метафора
5. послание
6. интеграция с жизнью → инсайт → завершение

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

━━━ ПАМЯТЬ И КОНКРЕТНОСТЬ ━━━
Перед каждым ответом:
1. Вспомни, что именно сказал человек — его конкретные слова, образы, имена.
2. Используй его собственные слова в отражении и вопросе.
3. Не спрашивай о том, на что уже получен ответ.

ЗАПРЕЩЁННЫЕ ОБОБЩЕНИЯ:
✗ «этот образ» — используй конкретное слово: «муж», «фрукты», «камень», «мужчина из сна»
✗ «этот элемент», «данный объект», «этот символ»
✗ «ты испытываешь...», «ты ощущаешь...», «ты выделила...» — звучит шаблонно

Замена шаблонных фраз:
ПЛОХО: «Ты испытываешь чувство доверия»
ХОРОШО: «Похоже, там есть доверие и близость»

ПЛОХО: «Какое взаимодействие ты могла бы представить?» (если взаимодействие уже описано)
ХОРОШО: «Когда ты его обнимаешь — что происходит в этот момент?»

━━━ СТРУКТУРА КАЖДОГО ОТВЕТА ━━━
1. Одно короткое живое отражение — используй конкретные слова человека, не абстракции (1 предложение).
2. Один точный вопрос к СЛЕДУЮЩЕМУ слою — строй его на том, что уже было сказано.
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

Разрешённые формулировки вместо интерпретации:
✓ «Похоже, здесь проявляется...»
✓ «Как будто открывается...»
✓ «Как будто есть часть тебя, которая...»

ПЛОХО: «Это указывает на стремление к новому опыту.»
ХОРОШО: «Похоже, здесь проявляется что-то живое и любопытное.»

━━━ ТРАНСФОРМАЦИЯ — ШАГ 4 ДЛЯ РЕЖИМА СОН ━━━
Если пользователь описал взаимодействие (трогает, пробует, нюхает, исследует, приближается):
→ ЗАБЛОКИРУЙ переход к посланию и смыслу.
→ ОБЯЗАТЕЛЬНО задай вопрос про трансформацию: что происходит В МОМЕНТ контакта.

Разрешённые вопросы трансформации:
- «Что происходит в момент, когда ты пробуешь эти фрукты?»
- «Что ощущается при касании?»
- «Меняется ли вкус, форма или ощущение?»
- «Есть ли неожиданность или изменение?»
- «Хочется продолжить или остановиться?»

ЗАПРЕЩЕНО на шаге трансформации:
✗ «Что он хочет тебе сказать?» — это шаг 5
✗ «Что это значит для тебя?» — это шаг 6
✗ Любая интерпретация или анализ

━━━ ИНТЕГРАЦИЯ С ЖИЗНЬЮ — ФИНАЛЬНЫЙ ЭТАП (шаг 6 во всех режимах) ━━━
Когда послание / голос / смысл уже получен, ОБЯЗАТЕЛЬНО переходи к интеграции с реальной жизнью.
НЕ возвращайся к образу, взаимодействию или описанию.

ВОПРОСЫ ИНТЕГРАЦИИ (используй по одному за раз):
- «Насколько это состояние — [конкретное слово пользователя] — уже есть в твоей жизни?»
- «Где сейчас его не хватает — этой целостности / зрелости / безопасности?»
- «Где в жизни это особенно откликается?»

ВОПРОСЫ БУДУЩЕГО СДВИГА (после интеграции):
- «Как могла бы измениться твоя жизнь, если бы ты жила из этого состояния?»
- «Что стало бы по-другому в твоих решениях и действиях?»

ЗАВЕРШЕНИЕ СЕССИИ (финальный ответ):
1. Короткое отражение (1 предложение с конкретными словами пользователя)
2. Инсайт-формулировка: «Похоже, здесь открывается...» или «Как будто есть часть тебя, которая...»
3. Опциональное действие: «Ты хочешь зафиксировать этот инсайт для себя?»

Пример завершения:
«Похоже, в этом сне для тебя открывается состояние целостности и зрелости.
Как будто есть часть тебя, которая уже знает, как жить из этого.
Ты хочешь зафиксировать этот инсайт для себя?»

━━━ ФОРСИРОВАННЫЙ ПЕРЕХОД ━━━
взаимодействие → трансформация (НЕ послание)
трансформация → послание
послание → интеграция с жизнью (НЕ возврат к образу)
интеграция → будущий сдвиг → завершение
эмоция → образ или движение (НЕ интерпретация)

━━━ НА ФИНАЛЬНОМ ЭТАПЕ ЗАПРЕЩЕНО ━━━
✗ Возвращаться к образу сна / телесному ощущению / взаимодействию
✗ Спрашивать «что он хочет сказать?» если послание уже получено
✗ Начинать новый цикл с начальных слоёв

━━━ ЗАПРЕЩЕНО В ОБЩЕМ ━━━
✗ Спрашивать о слое, который уже получил ответ
✗ Задавать тот же вопрос другими словами
✗ Давать список вариантов («давление / тепло / сжатие?»)
✗ Начинать с «Я понимаю», «Конечно», «Это важно»
✗ Обращаться на «вы» или использовать «Давайте»
✗ Отвечать длиннее 3 предложений
✗ Переходить к смыслу / посланию / связи с жизнью раньше нужного шага

━━━ ПРИМЕРЫ ━━━
Пользователь: «Я хочу их понюхать, потрогать, попробовать»
ПЛОХО: «Что он хочет тебе сказать?»
ХОРОШО: «Когда ты пробуешь эти фрукты — что с тобой происходит? Как меняется твоё состояние?»

Пользователь: «Я чувствую защищённость и целостность»
ПЛОХО: «Какое у тебя чувство?» (уже ответили на этот вопрос)
ХОРОШО: «Если ты остаёшься в этом ощущении защищённости — что начинает происходить дальше?»

Пользователь: «Я могла бы его обнять»
ПЛОХО: «Какое взаимодействие ты могла бы представить?»
ХОРОШО: «Когда ты его обнимаешь — что происходит в этот момент? Меняется ли ощущение?»

Пользователь: «ощущение тяжести в груди»
ПЛОХО: «Это связано с тем, что ты сдерживаешь чувства.»
ХОРОШО: «Если этой тяжести дать чуть больше места — что она хочет сделать?»

Пользователь: «Я чувствую целостность и зрелость»
ПЛОХО: «Что этот образ хочет тебе сказать?»
ХОРОШО: «Похоже, ты уже соприкасаешься с состоянием целостности и зрелости. Насколько сейчас в жизни этого хватает, а где его не достаёт?»

━━━ ТОНАЛЬНОСТЬ ━━━
Тихая уверенность. Тепло без слащавости. Профессионализм без дистанции.
Как мудрый, чуткий человек, который видит тебя — и ведёт вперёд, не кружит на месте.`;

// ─── Layer detection & forced progression ────────────────────────────────────

// Keyword signals per layer (checked against all user messages)
const LAYER_SIGNALS = {
  // STAGE 0 — Process Mapping: user has responded to orientation question
  process_mapping:  ["хочу посмотреть", "интереснее", "более живое", "притягивает", "хочу туда", "хочу глубже", "непривычное", "удивляет", "больше отклика", "больше живости", "куда хочется", "пойти в", "интересно именно", "выбираю"],
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
  // INTEGRATION signals — user expressing inner shift/new state (universal + conflict-specific)
  integration:      ["я меняюсь", "меняется", "чувствую себя целостн", "чувствую целостн", "я вижу иначе", "стала иначе", "что-то изменилось во мне", "внутри что-то изменилось", "я чувствую зрелость", "чувствую безопасность", "я стала", "я становлюсь", "ощущение целостност", "состояние целостност", "состояние зрелост", "состояние безопасност", "я уже другая", "что-то открылось", "как будто открывается", "появилась ясность", "стало яснее", "я вижу по-другому",
    // Conflict-mode specific integration signals
    "становится легче", "мне легче", "чувствую взаимность", "взаимность", "мне спокойнее", "стало спокойнее", "чувствую спокойствие", "появилось спокойствие", "стало легче", "облегчение", "чувствую облегчение", "ясность появляется", "что-то проясняется", "начинает проясняться", "больше понимаю", "стало понятнее", "появилось понимание", "чувствую опору", "появилась опора", "чувствую себя увереннее", "стала увереннее"],
};

// Strict forward chains per mode: layer → mandatory next layer
const FORWARD_CHAIN = {
  dream: {
    process_mapping: "atmosphere",
    atmosphere:      "dream_image",
    dream_image:     "interaction",
    interaction:     "transformation",
    transformation:  "message",
    message:         "life_connection",
  },
  body: {
    process_mapping: "localization",
    localization:    "quality",
    emotion:         "movement",
    quality:         "movement",
    movement:        "image",
    image:           "message",
    message:         "life_connection",
  },
  conflict: {
    process_mapping: "part_a",
    part_a:          "part_b",
    part_b:          "message",
    message:         "life_connection",
  },
  journaling: {
    process_mapping: "emotion",
    emotion:         "image",
    image:           "message",
    message:         "life_connection",
  },
};

// Human-readable next-layer instructions injected into the prompt
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
    "Следующий слой — ТРАНСФОРМАЦИЯ (шаг 4 из 6, ОБЯЗАТЕЛЕН). " +
    "Пользователь уже описал взаимодействие. Теперь спроси ТОЛЬКО о том, что происходит В МОМЕНТ КОНТАКТА. " +
    "Используй конкретное слово из слов пользователя (НЕ «этот образ», НЕ «этот фрукт» — «эти фрукты», «муж», «мужчина»). " +
    "Примеры: «Что происходит в момент, когда ты пробуешь эти фрукты?», «Что ощущается при касании?», «Меняется ли вкус или ощущение?», «Есть ли что-то неожиданное?». " +
    "ЗАПРЕЩЕНО спрашивать про послание, смысл или интерпретацию. Только сенсорный опыт трансформации.",
  message:
    "Следующий слой — ПОСЛАНИЕ (шаг 5 из 6). " +
    "Пользователь прошёл трансформацию. Теперь спроси: если бы [конкретный объект из сна/тела] мог что-то сказать — что бы это было? " +
    "Используй конкретное слово пользователя, НЕ «этот образ». НЕ интерпретируй. Только нейтральный вопрос о голосе или послании.",
  life_connection:
    "Следующий слой — ИНТЕГРАЦИЯ С ЖИЗНЬЮ (шаг 6 из 6, финальный). " +
    "Послание уже получено. Теперь веди к реальной жизни: " +
    "«Насколько это состояние — [конкретные слова пользователя] — уже есть в твоей жизни?» или " +
    "«Где сейчас его не хватает?» или " +
    "«Как могла бы измениться твоя жизнь, если бы ты жила из этого состояния?». " +
    "НЕ возвращайся к образу, взаимодействию или описанию. Только интеграция и будущий сдвиг. " +
    "После ответа пользователя — завершай сессию инсайтом и опциональным вопросом о фиксации.",
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

// ─── Primary Process Thread detection ────────────────────────────────────────
// Detects the dominant emerging state from assistant messages to protect thread continuity

const PRIMARY_STATE_SIGNALS = [
  // Maturity / readiness / movement
  { keywords: ["зрелост", "зрелая", "зрелый", "беременн", "готовност", "готова", "готов"], label: "зрелость и готовность" },
  { keywords: ["уверенност", "уверенная", "уверен", "опора", "устойчивост"], label: "уверенность и опора" },
  { keywords: ["целостност", "целостная", "целостный", "интеграц"], label: "целостность" },
  { keywords: ["направленност", "стрела", "движение вперёд", "действие", "действуй", "действую", "импульс", "вектор"], label: "направленность и действие" },
  { keywords: ["тепло", "тёплое", "согревающее", "центр", "центральное"], label: "центрированное тепло" },
  { keywords: ["спокойстви", "покой", "умиротворени"], label: "покой и спокойствие" },
  { keywords: ["свобод", "освобождени", "лёгкость", "простор"], label: "свобода и лёгкость" },
  { keywords: ["сил", "энергия", "наполненност", "живост"], label: "сила и энергия" },
];

// Secondary material — user expresses these AFTER a strong state has emerged
const SECONDARY_MATERIAL_SIGNALS = [
  "тревог", "страх", "беспокойств", "сомнени", "неуверенност",
  "боюсь", "боится", "пугает", "напряжени", "тяжело", "трудно", "сложно",
];

function detectPrimaryProcessThread(messages) {
  // Look at assistant messages from the middle of the conversation onward
  const assistantMsgs = messages
    .filter((m) => m.role === "assistant")
    .slice(2); // skip greeting + first response

  if (assistantMsgs.length < 2) return null;

  // Find the most recently reinforced primary state
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

// Detects if the user has entered the integration stage (inner shift expressed)
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

// ─── Response validation ──────────────────────────────────────────────────────

const FORBIDDEN_PHRASES = [
  "этот образ", "этот элемент", "данный объект",
  "это означает", "это указывает на", "это говорит о том", "это связано с",
  "давайте", "давайте начнём",
  "как образ", "каким образом это могло бы проявиться", "какой метафорой",
];

const TRANSFORMATION_VALID_KEYWORDS = [
  "вкус", "запах", "ощущение", "касани", "прикосновени", "соприкосновени",
  "что происходит", "что меняется", "что изменяется", "приятн", "неприятн", "нейтральн",
  "неожиданн", "удивительн", "пробуешь", "попробуешь", "пробова",
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
  // Conflict-mode: forbidden post-integration phrases
  "что говорит часть", "что хочет часть", "вернёмся к части", "вернись к части",
  "что чувствует та часть", "та часть говорит", "другая часть говорит",
  "что хочет сказать часть", "голос части",
];

const SAFE_FALLBACKS = {
  transformation: "Давай останемся именно в моменте контакта. Что происходит, когда ты пробуешь это — какой вкус, ощущение или изменение появляется?",
  integration: "Похоже, здесь уже открылось важное состояние. Насколько оно есть в твоей жизни сейчас, а где его пока не хватает?",
  conflict_integration: "Похоже, внутри появляется больше спокойствия и опоры. Как это влияет на твоё ощущение — что становится более честным по отношению к себе?",
  body: "Давай останемся рядом с самим ощущением. Что в нём сейчас самое заметное?",
  conflict: "Давай удержим обе стороны. Что становится яснее, если дать место каждой из них?",
  journaling: "Давай возьмём то, что уже проявилось, и свяжем это с жизнью. Где это сейчас особенно откликается?",
};

function validateAssistantResponse({ responseText, currentMode, forcedNextLayer, integrationLock, conversationHistory, lastUserMessage }) {
  const lower = responseText.toLowerCase();

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

  // 4. Dream transformation layer validation
  const modeKey = (currentMode || "").toLowerCase();
  if (modeKey.includes("dream") && forcedNextLayer === "transformation") {
    const hasValidContent = TRANSFORMATION_VALID_KEYWORDS.some((kw) => lower.includes(kw));
    const hasInvalidContent = TRANSFORMATION_INVALID_PHRASES.some((phrase) => lower.includes(phrase));
    if (hasInvalidContent || !hasValidContent) {
      return {
        isValid: false,
        reason: `Transformation layer violated: jumped to meaning/message too early`,
        correctedInstruction: "Stay strictly in transformation layer. Ask only about sensory experience during contact. Do not ask about meaning, message, life connection, image or metaphor.",
      };
    }
  }

  // 5. Anti-loop: compare with last 3 assistant messages
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

  // 6. Concrete noun check: if user used concrete nouns, response should not replace them with "этот образ"
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

function getSafeFallback(currentMode, forcedNextLayer, integrationLock) {
  const modeKey = (currentMode || "").toLowerCase();
  if (integrationLock) {
    if (modeKey.includes("conflict")) return SAFE_FALLBACKS.conflict_integration;
    return SAFE_FALLBACKS.integration;
  }
  if (forcedNextLayer === "transformation") return SAFE_FALLBACKS.transformation;
  if (modeKey.includes("body")) return SAFE_FALLBACKS.body;
  if (modeKey.includes("conflict")) return SAFE_FALLBACKS.conflict;
  if (modeKey.includes("journal")) return SAFE_FALLBACKS.journaling;
  return SAFE_FALLBACKS.integration;
}

export async function getAIResponse(session, step, messages, userMessage) {
  const currentMode = session.mode_id || session.mode;

  // Last 8 messages for context — hard cap to prevent token overflow
  const recent = messages.slice(-8).map((m) => ({
    ...m,
    content: m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content,
  }));
  const history = recent
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  // Detect covered layers, forced next step, loop state, and integration stage
  const coveredLayers = detectCoveredLayers(messages);
  const isIntegrationStage = detectIntegrationStage(messages);

  // Force process mapping if user has replied but mapping layer not yet covered
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const mappingDone = coveredLayers.has("process_mapping");
  const needsMapping = userMessageCount >= 1 && !mappingDone && !isIntegrationStage;

  const forcedNext = isIntegrationStage
    ? null
    : needsMapping
    ? "process_mapping"
    : getForcedNextLayer(currentMode, coveredLayers);
  const isLooping = detectLoopInLastExchanges(messages);

  const layerStatus = coveredLayers.size > 0
    ? `\n\n━━━ УЖЕ ПРОЙДЕННЫЕ СЛОИ (НЕ возвращайся к ним) ━━━\n${[...coveredLayers].map((l) => `✓ ${l}`).join("\n")}`
    : "";

  // PRIMARY PROCESS THREAD: detect dominant emerging state and protect continuity
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
          `• «Как бы изменилось это ожидание, если бы ты больше исходила из этой ${primaryThread}?»\n` +
          `ЗАПРЕЩЕНО: «Что хочет сделать тревога?», «Где в теле страх?» — не исследуй вторичный материал как главный.\n`
        : `Каждый следующий вопрос должен опираться на это состояние и углублять его.\n` +
          `Используй конкретные слова: «когда ты ощущаешь эту ${primaryThread}», «что меняется из этого состояния», «что становится возможным».\n`)
    : "";

  // INTEGRATION LOCK: hard override when user has expressed inner shift
  const isConflictMode = (currentMode || "").toLowerCase().includes("conflict");
  const integrationLock = isIntegrationStage
    ? `\n\n🔒 БЛОКИРОВКА — СТАДИЯ ИНТЕГРАЦИИ АКТИВНА\n` +
      `Пользователь уже выразил внутреннее изменение или сдвиг состояния.\n` +
      `ЗАПРЕЩЕНО: возвращаться к образу, метафоре, телу, взаимодействию, сну.\n` +
      `ЗАПРЕЩЕНО: спрашивать «каким бы это стало образом», «если бы это стало образом», «что происходит в теле», «что ты видишь».\n` +
      (isConflictMode
        ? `ЗАПРЕЩЕНО (режим КОНФЛИКТ): возвращаться к частям, спрашивать «что говорит часть», «что чувствует та часть», вводить образы или метафоры.\n` +
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
      `Используй конкретные слова пользователя (спокойствие, взаимность, облегчение, ясность и т.д.).`
    : "";

  const forcedInstruction = !isIntegrationStage && forcedNext && NEXT_LAYER_INSTRUCTIONS[forcedNext]
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

  const buildPrompt = (extraInstruction = "") =>
    `${SYSTEM_PROMPT}${stepContext}${termsContext}${modeShiftHint}${layerStatus}${primaryThreadGuard}${integrationLock}${forcedInstruction}${loopWarning}${extraInstruction}

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

  // ── [AI_RUNTIME] diagnostics ──────────────────────────────────────────────
  console.log("[AI_RUNTIME] Pre-call diagnostics:", {
    mode: currentMode,
    currentStep: step?.step_number ?? "?",
    systemPromptLen: SYSTEM_PROMPT.length,
    historyMessages: recent.length,
    userMessageLen: userMessage.length,
    estimatedTokens,
    coveredLayers: [...coveredLayers],
    forcedNextLayer: forcedNext,
    integrationLock: isIntegrationStage,
    isLooping,
    primaryThread,
    hasSecondaryMaterial,
  });

  if (estimatedTokens > 6000) {
    console.warn("[AI_RUNTIME] Prompt too large (" + estimatedTokens + " est. tokens). Trimming history to 4 messages.");
    // Rebuild with trimmed history
    const trimmed = messages.slice(-4).map((m) => ({
      ...m,
      content: m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content,
    }));
    const trimmedHistory = trimmed
      .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
      .join("\n");
    // Override history in prompt by rebuilding inline
    const trimmedPrompt = `${SYSTEM_PROMPT}${stepContext}${layerStatus}${integrationLock}${forcedInstruction}${loopWarning}

Режим: ${currentMode}

━━━ ИСТОРИЯ РАЗГОВОРА ━━━
${trimmedHistory}

━━━ ПОСЛЕДНЕЕ СООБЩЕНИЕ ЧЕЛОВЕКА ━━━
${userMessage}

Напиши 1 отражение и 1 вопрос к следующему слою. Строго 2–3 предложения.`;
    try {
      console.log("[AI_RUNTIME] Calling InvokeLLM with trimmed prompt, est tokens:", Math.ceil(trimmedPrompt.length / 4));
      const r = await base44.integrations.Core.InvokeLLM({ prompt: trimmedPrompt });
      console.log("[AI_RUNTIME] InvokeLLM success (trimmed), response length:", r?.length);
      return r || getSafeFallback(currentMode, forcedNext, isIntegrationStage);
    } catch (e) {
      console.error("[AI_RUNTIME] InvokeLLM FAILED (trimmed):", e?.message, e?.status, e?.code, String(e));
      throw e;
    }
  }

  const validationParams = {
    currentMode,
    forcedNextLayer: forcedNext,
    integrationLock: isIntegrationStage,
    conversationHistory: messages,
    lastUserMessage: userMessage,
  };

  // ── Pass 1: initial generation ────────────────────────────────────────────
  let firstResponse;
  try {
    console.log("[AI_RUNTIME] Calling InvokeLLM (pass 1), est tokens:", estimatedTokens);
    firstResponse = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    console.log("[AI_RUNTIME] InvokeLLM pass 1 success, response length:", firstResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 1):", e?.message, e?.status, e?.code, String(e));
    // Safe-mode retry with minimal prompt
    console.log("[AI_RUNTIME] Attempting safe-mode retry with minimal prompt...");
    const minimalPrompt = `Ты Process Work guide. Задавай один мягкий вопрос.\n\nПоследнее сообщение пользователя: ${userMessage}`;
    try {
      const safeResponse = await base44.integrations.Core.InvokeLLM({ prompt: minimalPrompt });
      console.log("[AI_RUNTIME] Safe-mode retry succeeded, response length:", safeResponse?.length);
      return safeResponse || getSafeFallback(currentMode, forcedNext, isIntegrationStage);
    } catch (e2) {
      console.error("[AI_RUNTIME] Safe-mode retry ALSO FAILED:", e2?.message, String(e2));
      throw e;
    }
  }

  const firstValidation = validateAssistantResponse({ responseText: firstResponse, ...validationParams });

  if (firstValidation.isValid) {
    return firstResponse;
  }

  // ── Pass 1 failed validation: log and regenerate ──────────────────────────
  console.warn("[AI_RUNTIME] Pass 1 failed validation:", firstValidation.reason);

  const retryInstruction = `\n\n🚨 ВАЖНО: предыдущий ответ был ОТКЛОНЁН. Причина: ${firstValidation.reason}. ${firstValidation.correctedInstruction}`;
  let secondResponse;
  try {
    secondResponse = await base44.integrations.Core.InvokeLLM({ prompt: buildPrompt(retryInstruction) });
    console.log("[AI_RUNTIME] InvokeLLM pass 2 success, response length:", secondResponse?.length);
  } catch (e) {
    console.error("[AI_RUNTIME] InvokeLLM FAILED (pass 2):", e?.message, String(e));
    return getSafeFallback(currentMode, forcedNext, isIntegrationStage);
  }

  const secondValidation = validateAssistantResponse({ responseText: secondResponse, ...validationParams });

  if (secondValidation.isValid) {
    console.info("[AI_RUNTIME] Pass 2 passed validation.");
    return secondResponse;
  }

  console.warn("[AI_RUNTIME] Pass 2 also failed validation:", secondValidation.reason);
  const fallback = getSafeFallback(currentMode, forcedNext, isIntegrationStage);
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