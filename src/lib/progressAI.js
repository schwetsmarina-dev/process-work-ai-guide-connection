import { base44 } from "@/api/base44Client";

// Signature of this week's sessions — changes when a new session lands,
// which invalidates the cached recap so it regenerates.
function weekSignature(sessions) {
  return sessions
    .map((s) => s.id)
    .sort()
    .join(",");
}

/**
 * Generates a short, warm, non-interpretive narrative recap of the user's
 * process THIS WEEK, in their language. Cached in localStorage per (week +
 * session set) so it is generated at most once per distinct week state.
 * Returns a string, or null on empty input / failure (caller falls back).
 */
export async function generateWeeklyRecap({ weekStartKey, sessions, lang = "ru" }) {
  if (!sessions || sessions.length === 0) return null;

  const cacheKey = `pw_recap_${weekStartKey}_${weekSignature(sessions)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {
    /* localStorage unavailable — just skip caching */
  }

  const ctx = sessions
    .map((s, i) => {
      const mode = s.mode_id || s.mode || "";
      const themes = Array.isArray(s.themes) ? s.themes.join(", ") : "";
      const summary = (s.summary || "").slice(0, 400);
      return `Сессия ${i + 1} — режим: ${mode}${themes ? `; темы: ${themes}` : ""}${
        summary ? `; суть: ${summary}` : ""
      }`;
    })
    .join("\n");

  const isEs = lang === "es";
  const prompt = isEs
    ? `Eres un facilitador de Process Work. Basándote SOLO en las sesiones de esta semana del usuario, escribe un resumen cálido y breve (1-2 frases) de su proceso de esta semana.
Reglas:
- En español, en segunda persona y preferiblemente en presente, sin marcar género (p. ej. "Esta semana exploras...", "En el centro está...").
- Descriptivo, NO interpretativo ni diagnóstico. Sin "esto significa/indica/simboliza".
- Refleja los temas que se repiten, sin inventar nada.
- Tono suave, respetuoso, alentador pero sobrio.

Sesiones de esta semana:
${ctx}`
    : `Ты — Process Work фасилитатор. На основе ТОЛЬКО сессий пользователя за эту неделю напиши тёплую короткую сводку (1-2 предложения) его процесса за неделю.
Правила:
- По-русски, во втором лице и предпочтительно в настоящем времени, БЕЗ указания пола (например: «На этой неделе ты исследуешь…», «В фокусе — …»).
- Описательно, НЕ интерпретируя и не диагностируя. Без «это означает/указывает/символизирует».
- Отрази повторяющиеся темы, ничего не выдумывая.
- Тон мягкий, уважительный, поддерживающий, но сдержанный.

Сессии за эту неделю:
${ctx}`;

  try {
    const res = await base44.functions.invoke("invokeAI", {
      prompt,
      response_json_schema: {
        type: "object",
        properties: { recap: { type: "string" } },
      },
    });
    const recap = res?.data?.response?.recap?.trim() || null;
    if (recap) {
      try {
        localStorage.setItem(cacheKey, recap);
      } catch {
        /* ignore cache write failure */
      }
    }
    return recap;
  } catch (e) {
    console.warn("[weeklyRecap] generation failed:", e?.message);
    return null;
  }
}
