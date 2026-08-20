import { base44 } from "@/api/base44Client";

function signature(sessions) {
  return sessions.map((s) => s.id).filter(Boolean).sort().join(",");
}

export async function generateThemePatterns({ sessions, lang = "ru" }) {
  const completed = (sessions || []).filter((s) => s.status === "completed").slice(0, 30);
  if (completed.length < 3) return [];

  const cacheKey = `talvira_theme_patterns_${lang}_${signature(completed)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const ctx = completed.map((s, i) => {
    const mode = s.mode_id || s.mode || "";
    const themes = Array.isArray(s.themes) ? s.themes.join(", ") : "";
    const primary = Array.isArray(s.primary_process) ? s.primary_process.join("; ") : "";
    const secondary = Array.isArray(s.secondary_process) ? s.secondary_process.join("; ") : "";
    const edge = Array.isArray(s.edge_signals) ? s.edge_signals.join("; ") : "";
    const summary = String(s.summary || "").slice(0, 550);
    return [
      `ID:${s.id}`,
      `mode:${mode}`,
      themes && `themes:${themes}`,
      summary && `summary:${summary}`,
      primary && `primary:${primary.slice(0, 300)}`,
      secondary && `secondary:${secondary.slice(0, 300)}`,
      edge && `edge:${edge.slice(0, 300)}`,
    ].filter(Boolean).join(" | ");
  }).join("\n");

  const isEs = lang === "es";
  const prompt = isEs
    ? `Analiza SOLO los datos de sesiones del usuario de abajo y detecta hasta 5 temas que se repiten en AL MENOS 2 sesiones. Agrupa formulaciones claramente equivalentes, pero no inventes conexiones débiles. Prioriza temas que aparezcan en más de un modo.

Reglas de seguridad y método:
- Esto NO es diagnóstico ni interpretación clínica.
- Formula cada patrón como una observación provisional: "Se repite...", "Aparece en...".
- No afirmes causas ni significados ocultos.
- Usa únicamente evidencia explícita de themes, summary, primary, secondary y edge.
- session_ids debe contener solo IDs reales de la entrada.
- modes debe contener solo modos presentes en esas sesiones.
- observation: 1-2 frases, sobrias y no diagnósticas.
- Si no hay evidencia suficiente, devuelve menos patrones o ninguno.

Sesiones:\n${ctx}`
    : `Проанализируй ТОЛЬКО данные сессий пользователя ниже и выдели до 5 тем, которые повторяются МИНИМУМ в 2 сессиях. Объединяй явно эквивалентные формулировки, но не придумывай слабые связи. Приоритет — темам, проявляющимся более чем в одном режиме.

Правила безопасности и метода:
- Это НЕ диагноз и не клиническая интерпретация.
- Формулируй каждый паттерн как предварительное наблюдение: «Повторяется…», «Появляется в…».
- Не утверждай причин и скрытых значений.
- Используй только явные данные из themes, summary, primary, secondary и edge.
- session_ids должны содержать только реальные ID из входных данных.
- modes должны содержать только режимы этих сессий.
- observation: 1–2 сдержанных, недиагностических предложения.
- Если доказательств недостаточно, верни меньше паттернов или пустой список.

Сессии:\n${ctx}`;

  try {
    const res = await base44.functions.invoke("invokeAI", {
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          patterns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                observation: { type: "string" },
                session_ids: { type: "array", items: { type: "string" } },
                modes: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    });
    const validIds = new Set(completed.map((s) => String(s.id)));
    const patterns = (res?.data?.response?.patterns || [])
      .map((p) => ({
        label: String(p.label || "").trim(),
        observation: String(p.observation || "").trim(),
        session_ids: [...new Set((p.session_ids || []).map(String).filter((id) => validIds.has(id)))],
        modes: [...new Set((p.modes || []).map(String).filter(Boolean))],
      }))
      .filter((p) => p.label && p.observation && p.session_ids.length >= 2)
      .slice(0, 5);
    try { localStorage.setItem(cacheKey, JSON.stringify(patterns)); } catch {}
    return patterns;
  } catch (e) {
    console.warn("[themePatterns] generation failed:", e?.message);
    return [];
  }
}
