import { base44 } from "@/api/base44Client";

// Resolve the AppUser.id for the current authenticated user.
async function getCurrentAppUserId() {
  const user = await base44.auth.me();
  if (!user?.email) return null;
  const rows = await base44.entities.AppUser.filter({ email: user.email });
  return rows[0]?.id || null;
}

export async function extractInsightsFromSession(session, messages, language = "es") {
  // Insights must reflect the USER's own discoveries — use ONLY user messages.
  const userMessages = messages
    .filter((m) => m.role === "user")
    .slice(-16)
    .map((m) => m.content)
    .join("\n");

  if (!userMessages.trim()) return [];

  const isEs = language === "es";
  const prompt = isEs
    ? `Eres facilitador de Process Work. A partir SOLO de las RESPUESTAS DEL USUARIO, extrae 2-3 descubrimientos personales clave.

Modo: ${session.mode_id || session.mode}

Reglas:
- Idioma: español natural.
- Cada descubrimiento debe ser una frase en PRIMERA PERSONA (por ejemplo: «Me doy cuenta de…», «Siento…», «Noto…»).
- Basado SOLO en las palabras del usuario, nunca en frases del asistente.
- Concreto, no diagnóstico y no interpretativo.
- No uses frases como «esto significa», «esto indica» o «esto simboliza».
- Conserva las palabras concretas del usuario.
- importance: 1 = observación ligera, 2 = significativo, 3 = insight clave.

Ejemplo válido:
«Noto que cuando me siento segura, miro el mundo con más madurez.»

Ejemplo no válido, porque es una frase del asistente:
«Empecemos. ¿Qué quieres explorar hoy?»

Respuestas del usuario:
${userMessages}`
    : `Ты — Process Work фасилитатор. На основе ОТВЕТОВ ПОЛЬЗОВАТЕЛЯ выдели 2-3 ключевых личных открытия.

Режим: ${session.mode_id || session.mode}

Правила:
- Язык: русский
- Каждое открытие — одно предложение от ПЕРВОГО ЛИЦА (Я понял… / Я чувствую… / Я замечаю…)
- Основаны ТОЛЬКО на словах самого пользователя, не на репликах ассистента
- Конкретные, не диагностические, не интерпретирующие
- Без фраз «это означает», «это указывает на», «это символизирует»
- Сохраняй конкретные слова пользователя
- importance: 1 = лёгкое наблюдение, 2 = значимое, 3 = ключевой инсайт

Ответы пользователя:
${userMessages}`;

  const res = await base44.functions.invoke("invokeAI", {
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              insight_text: { type: "string" },
              state_keywords: { type: "string" },
              process_layer: { type: "string" },
              tags: { type: "string" },
              importance: { type: "number" },
            },
          },
        },
      },
    },
  });

  return res?.data?.response?.insights || [];
}

export async function saveInsight({ sessionId, sourceMode, insight }) {
  const userId = await getCurrentAppUserId();
  return base44.entities.Insight.create({
    user_id: userId,
    session_id: sessionId || null,
    source_mode: sourceMode || "",
    title: insight.title,
    insight_text: insight.insight_text,
    state_keywords: insight.state_keywords || "",
    process_layer: insight.process_layer || "",
    tags: insight.tags || "",
    importance: insight.importance || 2,
    is_favorite: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Save an insight from a USER message only. Assistant text must never be saved.
export async function saveInsightFromMessage({ messageContent, sessionId, sourceMode }) {
  const userId = await getCurrentAppUserId();
  const words = messageContent.trim().split(/\s+/);
  const autoTitle = words.slice(0, 9).join(" ") + (words.length > 9 ? "…" : "");
  return base44.entities.Insight.create({
    user_id: userId,
    session_id: sessionId || null,
    source_mode: sourceMode || "",
    title: autoTitle,
    insight_text: messageContent,
    importance: 2,
    is_favorite: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}