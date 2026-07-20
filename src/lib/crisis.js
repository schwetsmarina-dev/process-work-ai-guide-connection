// Crisis & distress detection — multilingual (ru / es / en).
// Pure module (no external deps) so it is unit-testable in isolation.

// ─── Crisis detection ────────────────────────────────────────────────────────
const CRISIS_KEYWORDS = [
  // Russian
  "суицид", "убить себя", "покончить", "самоубийство",
  "самоповреждение", "порезать себя", "резать вены",
  "не хочу жить", "нет смысла жить", "лучше бы меня не было",
  "хочу умереть", "убить", "насилие",
  // Spanish
  "suicidio", "suicidarme", "matarme", "quitarme la vida",
  "hacerme daño", "autolesión", "cortarme", "no quiero vivir",
  "no quiero seguir viviendo", "quiero morir", "mejor no existir",
  // English
  "suicide", "kill myself", "end my life", "self-harm",
  "hurt myself", "cut myself", "don't want to live",
  "want to die", "better off dead",
];

// Localized crisis resources, shown when a crisis signal is detected.
const CRISIS_MESSAGES = {
  ru: `⚠️ Я заметил(а), что вы упомянули что-то важное.

Этот инструмент — для самоисследования, и он не заменяет профессиональную помощь.

Если вам сейчас тяжело, пожалуйста, обратитесь:

📞 Телефон доверия: 8-800-2000-122 (бесплатно, 24/7)
📞 Экстренная психологическая помощь МЧС: 8-499-216-50-50
📱 Линия психологической помощи: 051 (с мобильного)

Вы не одиноки. Помощь доступна.`,
  es: `⚠️ He notado que has mencionado algo importante.

Esta herramienta es para el autoconocimiento y no sustituye la ayuda profesional.

Si lo estás pasando mal ahora mismo, por favor contacta:

📞 Línea de atención a la conducta suicida: 024 (gratuito, 24/7)
📞 Emergencias: 112
📱 Teléfono de la Esperanza: 717 003 717

No estás solo/a. Hay ayuda disponible.`,
  en: `⚠️ I noticed you mentioned something important.

This tool is for self-exploration and is not a substitute for professional help.

If you're going through a hard time right now, please reach out:

📞 EU emergency number: 112
📞 Your local crisis or suicide helpline
📱 If you're in immediate danger, contact emergency services now.

You are not alone. Help is available.`,
};

// Backward-compatible default (Russian).
export const CRISIS_MESSAGE = CRISIS_MESSAGES.ru;

// Returns the crisis message in the user's language (falls back to Russian).
export function getCrisisMessage(language) {
  return CRISIS_MESSAGES[language] || CRISIS_MESSAGES.ru;
}

export function checkCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Low-severity distress detection (test condition) ────────────────────────
// Softer emotional-distress words. When present (and no full crisis), a RiskEvent
// with severity "low" should be created so distress is logged for review.
const LOW_RISK_KEYWORDS = [
  // Russian
  "смерть", "потеря", "не хочу жить", "горе",
  // Spanish
  "muerte", "pérdida", "duelo", "desesperación",
  // English
  "death", "loss", "grief", "hopeless",
];

export function checkLowRisk(text) {
  const lower = text.toLowerCase();
  return LOW_RISK_KEYWORDS.some((kw) => lower.includes(kw));
}
