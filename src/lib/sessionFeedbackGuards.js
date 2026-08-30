// Quality guards shared by generation, validation and the chat UI.
export const normalize = (s = "") => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ё/g, "е");
export function getTurnIntent(text = "") {
  const t = normalize(text);
  const continueRequested = /(?:хочу|давай|можно|будем).{0,25}(?:продолж|исслед|разобрат)|продолжаем|не хочу (?:заканч|заверш)|(?:quiero|quisiera|podemos|vamos a).{0,25}(?:seguir|continuar|explorar|profundizar)|no quiero (?:terminar|cerrar)/u.test(t);
  const explicitClose = /(?:^|[.!?]\s*|,\s*)(?:я )?(?:хочу завершить|хочу закончить|готова? завершить|на сегодня достаточно|мне достаточно|этого достаточно|не хочу больше копать|quiero terminar|quiero cerrar aqui|por hoy es suficiente|con esto me basta|no quiero seguir escarbando)(?:[.!?,]|$|\s)/u.test(t);
  const hypothetical = /(?:может быть|возможно|хотелось бы|если бы|стало бы|tal vez|quizas|ojala|me gustaria|seria|podria|iria|si pudiera)/u.test(t);
  const edge = /(?:но.{0,25}(?:боюсь|не могу|трудно)|мешает|стыд|снова должен|sigo bloquead|pero.{0,25}(?:miedo|no puedo|cuesta)|me impide|verguenza)/u.test(t);
  const negated = /(?:не чувствую|не стало|не понимаю|no me siento|no siento|no entiendo|no ha cambiado)/u.test(t);
  const shift = !hypothetical && !negated && /(?:облегчение|стало легче|напряжение ушло|отпустило|мне спокойно|alivio|no hay rigidez|tranquilidad|naturalidad|me siento tranquil|se ha soltado)/u.test(t);
  return { continueRequested, explicitClose: explicitClose && !continueRequested, hypothetical, edge, shift };
}
export function isIntegrationQuestion(text = "") {
  const t = normalize(text);
  return /[?？]/u.test(t) &&
    /(?:vida|dia a dia|cotidian|prioridad|pendiente|decision|жизн|повседнев|решени|дела|приоритет)/u.test(t) &&
    /(?:cambi|aporta|sumar|anadir|integr|llevar|incorpor|измен|добав|привнес|перенес|интегр|примен)/u.test(t);
}
export function answeredIntegration(messages = []) {
  // A later, explicitly reopened exploration may legitimately integrate again.
  const reopening = messages.findLastIndex(m => m.role === "user" && getTurnIntent(m.content).continueRequested);
  for (let i = messages.length - 2; i > reopening; i--) {
    if (messages[i].role !== "assistant" || !isIntegrationQuestion(messages[i].content)) continue;
    const answer = messages.slice(i + 1).find(m => m.role === "user");
    if (!answer) continue;
    const t = normalize(answer.content).trim();
    if (t && !/^(?:не знаю|не понимаю|no se|no entiendo|что|que)[.!?]*$/u.test(t)) return true;
  }
  return false;
}
export function validateFeedbackQuality(response, messages = [], userText = "") {
  if (typeof response !== "string" || !response.trim()) return { isValid: false, reason: "empty_response", correctedInstruction: "Return a short, grounded response." };
  const intent = getTurnIntent(userText);
  const r = normalize(response);
  if (answeredIntegration(messages) && isIntegrationQuestion(response) && !intent.continueRequested) {
    return { isValid: false, reason: "repeated_integration", correctedInstruction: "The life-integration question already has an answer. Reflect it without another variant. Offer the choice to finish or explore a specific remaining edge; do not assume completion." };
  }
  if (intent.hypothetical && /(?:ahora.{0,55}(?:se vuelve real|empieza a|has logrado)|ya (?:has|sientes|puedes)|ты уже|теперь ты|уже произош|ты чувствуешь, что)/u.test(r)) {
    return { isValid: false, reason: "hypothesis_as_result", correctedInstruction: "Preserve the conditional. A hoped-for change is not an achieved result. Ask whether anything is felt now, without presuming it." };
  }
  const userEvidence = normalize(messages.filter(m => m.role === "user").map(m => m.content).join(" "));
  if (/(?:sueno recurrente|повторяющ.{0,8}сон)/u.test(r) && !/(?:recurrent|repite|otra vez.{0,15}sueno|повтор|снова.{0,15}сон)/u.test(userEvidence)) {
    return { isValid: false, reason: "invented_recurrence", correctedInstruction: "Remove recurrence: the person did not say the dream repeats." };
  }
  return { isValid: true };
}
export function feedbackFallback(language, userText, messages = []) {
  const es = language === "es";
  const intent = getTurnIntent(userText);
  if (intent.explicitClose) return es ? "Podemos dejarlo aquí. Cuando quieras, pulsa «Finalizar sesión»." : "Можем на этом остановиться. Когда захочешь, нажми «Завершить сессию».";
  if (intent.hypothetical) return es ? "Lo planteas como una posibilidad. ¿Notas algún cambio ahora o todavía es algo que te gustaría experimentar?" : "Ты говоришь об этом как о возможности. Сейчас уже что-то изменилось или это пока то, что хотелось бы почувствовать?";
  if (answeredIntegration(messages) && !intent.continueRequested && !intent.edge) return es ? "Ya has nombrado lo que te llevas. ¿Prefieres dejarlo aquí por hoy o explorar algo que quedó pendiente?" : "Ты уже назвала, что берёшь с собой. Хочешь на сегодня остановиться или исследовать что-то оставшееся?";
  return es ? "Podemos seguir a tu ritmo. ¿En qué te gustaría detenerte ahora?" : "Можем продолжать в твоём темпе. На чём тебе хочется сейчас остановиться подробнее?";
}
export function feedbackInstructions(language, continued = false) {
  return language === "es" ? 
    "\nPRIORIDAD DE CALIDAD (sin anular seguridad): un descubrimiento o alivio NO equivale a querer terminar. No repitas la función de una pregunta de integración ya respondida. Ofrece terminar o seguir con lo pendiente, sin exigir una acción. Respeta condicionales: «tal vez/sería» no significa un cambio logrado. Distingue palabras de la persona e hipótesis tuyas, comprueba su resonancia. La figura del borde protege algo importante: explora qué protege, qué teme y qué experiencia hay detrás, sin inventar la historia concreta de la persona. No atribuyas fortaleza, recurrencia del sueño ni curación sin evidencia. Una pregunta concreta cada vez; si no se entiende, explica con lenguaje cotidiano y un ejemplo opcional, sin repetir «nuevo/extraño». Ante dificultad para moverse, aclara la experiencia y comodidad antes de amplificar. Sigue la cualidad vivida y el borde con consentimiento, sin convertir todo en un mensaje intelectual. Ante «debo resolver todo», comprueba si vuelve una exigencia, sin asumirlo. Conserva el trabajo de ambas posiciones antes/ahora. Al cerrar no hagas una nueva pregunta. " + (continued ? "La persona eligió continuar: el paso final es orientativo; sigue su nuevo foco o borde sin repetir el cierre ni reiniciar el mapa.\n" : "\n") :
    "\nПРИОРИТЕТ КАЧЕСТВА (не отменяет безопасность): осознание и облегчение НЕ означают желание закончить. Не повторяй функцию уже отвеченного вопроса об интеграции. Предложи завершить или исследовать оставшееся без требования плана действий. Сохраняй «возможно/было бы»: желание не равно результату. Различай слова человека и свои гипотезы, проверяй отклик. Краевая фигура защищает что-то важное: исследуй, что она защищает, чего опасается и какой опыт за этим стоит, не придумывая конкретную историю человека. Не приписывай силу, повторяемость сна или исцеление без свидетельства. Один конкретный вопрос; при непонимании поясни простыми словами с необязательным примером, не повторяй «новое/странное». При затруднении движения уточни опыт и комфорт до усиления. Следуй переживаемому качеству и краю с согласия, не своди всё к интеллектуальному посланию. При «надо решить всё» проверь, не возвращается ли требование, не утверждая этого заранее. Сохрани исследование обеих позиций раньше/теперь. При закрытии не задавай новый вопрос. " + (continued ? "Человек выбрал продолжение: финальный шаг совещательный; следуй новому фокусу или краю, не повторяй закрытие и не начинай карту заново.\n" : "\n");
}
