import { base44 } from "@/api/base44Client";

// Resolve the AppUser.id for the current authenticated user.
async function getCurrentAppUserId() {
  const user = await base44.auth.me();
  if (!user?.email) return null;
  const rows = await base44.entities.AppUser.filter({ email: user.email });
  return rows[0]?.id || null;
}

export async function extractInsightsFromSession(session, messages) {
  // Insights must reflect the USER's own discoveries — use ONLY user messages.
  const userMessages = messages
    .filter((m) => m.role === "user")
    .slice(-16)
    .map((m) => m.content)
    .join("\n");

  if (!userMessages.trim()) return [];

  const res = await base44.functions.invoke("invokeAI", {
    prompt: `Ты — Process Work фасилитатор. На основе ОТВЕТОВ ПОЛЬЗОВАТЕЛЯ выдели 2-3 ключевых личных открытия.

Режим: ${session.mode_id || session.mode}

Правила:
- Язык: русский
- Каждое открытие — одно предложение от ПЕРВОГО ЛИЦА (Я понял… / Я чувствую… / Я замечаю…)
- Основаны ТОЛЬКО на словах самого пользователя, не на репликах ассистента
- Конкретные, не диагностические, не интерпретирующие
- Без фраз «это означает», «это указывает на», «это символизирует»
- Сохраняй конкретные слова пользователя
- importance: 1 = лёгкое наблюдение, 2 = значимое, 3 = ключевой инсайт

Пример хорошего открытия:
"Я замечаю, что когда я чувствую безопасность, я смотрю на мир более зрелыми глазами."

Пример плохого открытия (реплика ассистента — НИКОГДА не использовать):
"Давай начнём. О чём ты хочешь поисследовать?"

Ответы пользователя:
${userMessages}`,
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