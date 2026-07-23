// ─── Completion / closure signals — process has naturally completed (all modes) ──

export const COMPLETION_SIGNALS = [
  // ── Clear insight / understanding ─────────────────────────────────────────
  "теперь я понимаю", "мне стало ясно", "я поняла", "я понял", "стало понятно",
  "я вижу теперь", "теперь вижу", "мне ясно", "стало яснее", "теперь понятно",
  "появилась ясность", "всё встало на место", "как будто открылось",
  "что-то прояснилось", "стало понятнее", "я увидела", "я увидел",
  // ── Stable empowered / grounded state ────────────────────────────────────
  "я чувствую силу", "я чувствую себя сильной", "я чувствую себя сильным",
  "я чувствую себя устойчиво", "я чувствую устойчивость", "чувствую опору",
  "я чувствую себя большой", "несокрушимой", "несокрушимым",
  "я чувствую себя целостно", "ощущение целостности", "я целостна", "я целостен",
  "я чувствую спокойствие", "мне спокойно", "я спокойна", "я спокоен",
  "я чувствую уверенность", "чувствую уверенность", "я уверена", "я уверен",
  "я чувствую направление", "появилось направление", "чувствую направление",
  "я чувствую завершённость", "чувствую завершённость", "чувствую завершенность",
  "это уже становится частью меня", "это становится частью меня",
  "я чувствую наполненность", "я наполнена", "я наполнен",
  // ── Emotional settling / relief ───────────────────────────────────────────
  "мне стало легче", "стало легче", "облегчение", "чувствую облегчение",
  "отпустило", "что-то отпустило", "напряжение ушло", "напряжение спало",
  "мне легче дышать", "я выдохнула", "я выдохнул", "выдыхаю",
  "стало теплее", "что-то тёплое", "появилось тепло",
  // ── Reduction of inner conflict / clarity between parts ───────────────────
  "части пришли к согласию", "части договорились", "между ними мир",
  "противоречие разрешилось", "конфликт разрешился", "я больше не разрываюсь",
  "я понимаю обе стороны", "обе стороны важны", "нашла баланс", "нашёл баланс",
  "стало честнее", "это честнее", "я честна с собой", "я честен с собой",
  // ── Grounded agency / self-protection ─────────────────────────────────────
  "я могу себя защитить", "я защищаю себя", "я умею защищать себя",
  "я беру ответственность", "я отвечаю за себя",
  "я забочусь о себе", "я хочу заботиться о себе", "забочусь о себе",
  "я могу позаботиться", "я готова позаботиться", "я готов позаботиться",
  // ── Clear direction / decision ────────────────────────────────────────────
  "я знаю, что делать", "я знаю что делать", "я понимаю что делать",
  "мне стало понятно что делать", "я вижу путь", "появился путь",
  "это важно для моих проектов", "это связано с моими проектами",
  "я готова к", "я готов к", "я двигаюсь вперёд",
  "я выхожу из этого", "я хочу применить это",
  "я знаю следующий шаг", "появился следующий шаг",
  "я вижу следующий шаг", "следующий шаг понятен",
  // ── Integration into real life ────────────────────────────────────────────
  "это важно для моей жизни", "это меняет мою жизнь",
  "я хочу это в свою жизнь", "это уже в моей жизни",
  "я хочу жить из этого", "хочу жить из этого",
  "это важно для меня", "это меняет что-то в моей жизни",
  // ── Body / symptom resolution (body mode) ─────────────────────────────────
  "тело успокоилось", "ощущение изменилось", "симптом изменился",
  "по-другому отношусь к", "я иначе смотрю на это",
  "тело говорит мне", "тело сказало", "я понимаю своё тело",
  "что-то расслабилось", "расслабилось", "отпустило в теле",
  // ── Natural ending / sufficiency ──────────────────────────────────────────
  "этого достаточно", "мне этого хватает", "я получила что хотела",
  "я получил что хотел", "сессия завершена для меня",
  "мне уже не хочется дальше копать", "не хочу больше копать",
  "я готова завершить", "я готов завершить", "хочу завершить",
  "это полно само по себе", "ощущение полноты", "я чувствую полноту",
  // ── Dream mode: integration of message ───────────────────────────────────
  "сон говорит мне", "сон сказал мне", "я понимаю этот сон",
  "послание сна", "я услышала послание", "я услышал послание",
  "сон о том, что", "сон был о том",
  // ── Reconnecting with life energy ────────────────────────────────────────
  "я снова чувствую себя живой", "я снова чувствую себя живым",
  "жизнь возвращается", "я возвращаюсь к себе", "я снова себя чувствую",
  "я снова дышу", "я снова здесь",

  // ══ ESPAÑOL ══════════════════════════════════════════════════════════════
  // Not a literal translation of the Russian list. Spanish speakers mark
  // closure differently — more often through "darse cuenta", "soltar" and
  // bodily calm than through the Russian "я поняла / стало ясно" pattern.
  // Review these with a native speaker before treating detection rates as real.

  // ── Insight / clarity ────────────────────────────────────────────
  "ahora lo entiendo", "ahora entiendo", "me he dado cuenta", "me doy cuenta",
  "ahora lo veo", "ahora lo veo claro", "lo veo más claro", "se me ha aclarado",
  "todo encaja", "ha encajado", "tiene sentido ahora", "ya tiene sentido",
  "se me ha abierto algo", "algo se ha aclarado", "lo comprendo",

  // ── Stable, grounded, empowered state ──────────────────────────────
  "me siento fuerte", "siento fuerza", "me siento firme", "me siento estable",
  "siento apoyo", "tengo los pies en la tierra", "me siento entera",
  "me siento entero", "siento plenitud", "me siento completa", "me siento completo",
  "me siento tranquila", "me siento tranquilo", "siento calma", "estoy en calma",
  "me siento segura", "me siento seguro", "siento confianza",
  "siento una dirección", "veo una dirección",
  "esto ya forma parte de mí", "ya es parte de mí",

  // ── Relief / settling ─────────────────────────────────────────
  "me siento más ligera", "me siento más ligero", "siento alivio",
  "he sentido alivio", "se ha soltado", "algo se ha soltado", "he soltado",
  "la tensión se ha ido", "se me ha quitado la tensión", "respiro mejor",
  "he respirado", "he podido respirar", "siento calor", "algo cálido",

  // ── Inner conflict resolving ───────────────────────────────────
  "las partes se han puesto de acuerdo", "hay paz entre ellas",
  "el conflicto se ha resuelto", "ya no me siento dividida",
  "ya no me siento dividido", "entiendo las dos partes",
  "las dos partes importan", "he encontrado un equilibrio",
  "es más honesto", "soy honesta conmigo", "soy honesto conmigo",

  // ── Agency / self-care ──────────────────────────────────────
  "puedo protegerme", "sé protegerme", "me protejo",
  "me hago cargo", "me responsabilizo", "me cuido", "quiero cuidarme",
  "puedo cuidar de mí", "estoy lista para cuidarme", "estoy listo para cuidarme",

  // ── Direction / decision ─────────────────────────────────────
  "sé qué hacer", "ya sé qué hacer", "veo el camino", "ha aparecido un camino",
  "sé cuál es el siguiente paso", "veo el siguiente paso",
  "el siguiente paso está claro", "estoy lista para", "estoy listo para",
  "voy hacia delante", "quiero aplicar esto", "estoy saliendo de esto",

  // ── Integration into life ────────────────────────────────────
  "esto es importante para mi vida", "esto cambia algo en mi vida",
  "quiero esto en mi vida", "ya está en mi vida", "quiero vivir desde aquí",
  "esto es importante para mí",

  // ── Body / symptom resolution ─────────────────────────────────
  "el cuerpo se ha calmado", "mi cuerpo se ha calmado",
  "la sensación ha cambiado", "el síntoma ha cambiado",
  "ahora lo miro de otra manera", "lo veo de otra forma",
  "mi cuerpo me dice", "el cuerpo me ha dicho", "entiendo a mi cuerpo",
  "algo se ha relajado", "se ha relajado",

  // ── Natural ending / sufficiency ───────────────────────────────
  "con esto me basta", "esto es suficiente", "ya es suficiente",
  "he conseguido lo que quería", "por hoy es suficiente",
  "no quiero seguir escarbando", "no quiero indagar más",
  "quiero terminar", "quiero cerrar aquí", "siento que está completo",

  // ── Dream mode ─────────────────────────────────────────────
  "el sueño me dice", "el sueño me dijo", "entiendo este sueño",
  "el mensaje del sueño", "he escuchado el mensaje", "el sueño iba de",

  // ── Reconnecting with life energy ──────────────────────────────
  "me siento viva otra vez", "me siento vivo otra vez",
  "la vida vuelve", "vuelvo a mí", "vuelvo a sentirme",
  "vuelvo a respirar", "estoy aquí otra vez",
];

// Detects if the process has reached a natural completion/closure state.
// Returns { isComplete: boolean, closureState: string, matchedSignal: string|null }
export function detectCompletionState(messages) {
  const userMessages = messages.filter((m) => m.role === "user");
  // Only check recent messages — completion must be fresh (last 3 user messages)
  const recentUserMessages = userMessages.slice(-3).map((m) => m.content.toLowerCase());
  const combined = recentUserMessages.join(" ");

  const matchedSignal = COMPLETION_SIGNALS.find((sig) => combined.includes(sig));
  if (matchedSignal) {
    return { isComplete: true, closureState: "integrated_empowered_state", matchedSignal };
  }
  return { isComplete: false, closureState: null, matchedSignal: null };
}