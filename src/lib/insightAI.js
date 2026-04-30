import { base44 } from "@/api/base44Client";

export async function extractInsightsFromSession(session, messages) {
  const conversation = messages
    .filter((m) => m.role !== "system")
    .slice(-16)
    .map((m) => `${m.role === "user" ? "П" : "А"}: ${m.content}`)
    .join("\n");

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Ты — Process Work фасилитатор. Извлеки до 3 личных инсайтов из этой сессии.

Режим: ${session.mode_id || session.mode}

Правила:
- Язык: русский
- Краткие, конкретные, основаны ТОЛЬКО на словах пользователя
- Написаны от первого лица, если уместно
- Не диагностические, не интерпретирующие
- Без фраз «это означает», «это указывает на», «это символизирует»
- Сохраняй конкретные слова пользователя
- importance: 1 = лёгкое наблюдение, 2 = значимое, 3 = ключевой инсайт

Пример хорошего инсайта:
"Когда я чувствую безопасность и целостность, я начинаю смотреть на мир более зрелыми глазами."

Пример плохого инсайта:
"Сон означает, что пользователь стремится к новому опыту."

Разговор:
${conversation}`,
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

  return result?.insights || [];
}

export async function saveInsight({ sessionId, sourceMode, insight, userId }) {
  return base44.entities.Insight.create({
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

export async function saveInsightFromMessage({ messageContent, sessionId, sourceMode }) {
  const words = messageContent.trim().split(/\s+/);
  const autoTitle = words.slice(0, 9).join(" ") + (words.length > 9 ? "…" : "");
  return base44.entities.Insight.create({
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