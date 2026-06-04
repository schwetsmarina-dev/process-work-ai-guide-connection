import { base44 } from "@/api/base44Client";

const MEMORY_LIMIT = 20;

// ─── 1. Load all active memories for the current user ────────────────────────
export async function loadUserMemories(userId) {
  if (!userId) return [];
  try {
    const rows = await base44.entities.UserMemory.filter(
      { user_id: userId, is_active: true },
      "-created_date",
      MEMORY_LIMIT
    );
    return rows || [];
  } catch (e) {
    console.error("[UserMemory] load failed:", e?.message);
    return [];
  }
}

// ─── 2. Format memories block for the system prompt ──────────────────────────
export function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return "";
  const lines = memories
    .map((m) => `- [${m.memory_type || "общее"}]: ${m.memory_value}`)
    .join("\n");
  return (
    `\n\n━━━ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ ━━━\n` +
    `Вот что ты знаешь об этом пользователе из прошлых сессий:\n${lines}\n` +
    `Учитывай это при работе с пользователем, но не упоминай явно, ` +
    `что ты «помнишь» — просто используй в контексте.`
  );
}

// ─── 3. Save memories: update existing per memory_type, enforce limit ────────
// items: [{ memory_type, memory_value }]
export async function saveUserMemories(userId, items, { sessionId, modeId } = {}) {
  if (!userId || !items || items.length === 0) return;

  const existing = await base44.entities.UserMemory.filter({ user_id: userId });
  const byType = {};
  for (const row of existing) {
    // keep newest per type for update target
    if (!byType[row.memory_type] || new Date(row.created_date) > new Date(byType[row.memory_type].created_date)) {
      byType[row.memory_type] = row;
    }
  }

  const now = new Date().toISOString();

  for (const item of items) {
    if (!item.memory_value) continue;
    const target = byType[item.memory_type];
    const payload = {
      user_id: userId,
      memory_type: item.memory_type,
      memory_key: item.memory_type,
      memory_value: item.memory_value,
      source_session_id: sessionId,
      source_mode_id: modeId,
      is_active: true,
      updated_at: now,
    };
    if (target) {
      await base44.entities.UserMemory.update(target.id, payload);
    } else {
      await base44.entities.UserMemory.create({ ...payload, created_at: now });
    }
  }

  // ─── Enforce limit of MEMORY_LIMIT records: delete oldest by created_date ───
  const all = await base44.entities.UserMemory.filter({ user_id: userId }, "-created_date", 200);
  if (all.length > MEMORY_LIMIT) {
    const toDelete = all.slice(MEMORY_LIMIT);
    for (const row of toDelete) {
      await base44.entities.UserMemory.delete(row.id);
    }
  }
}

// ─── 4. Analyze the session via Claude and extract memory items ──────────────
export async function extractMemoriesFromSession(messages) {
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  if (!conversation.trim()) return [];

  const result = await base44.integrations.Core.InvokeLLM({
    model: "claude_sonnet_4_6",
    prompt: `Проанализируй эту сессию и выдай JSON с полями:
{
  insights: [строки — ключевые открытия пользователя],
  patterns: [строки — паттерны поведения или реакций],
  themes: [строки — повторяющиеся темы],
  progress: строка — в чём продвинулся пользователь
}
Только факты из сессии, без интерпретаций.

Сессия:
${conversation}`,
    response_json_schema: {
      type: "object",
      properties: {
        insights: { type: "array", items: { type: "string" } },
        patterns: { type: "array", items: { type: "string" } },
        themes: { type: "array", items: { type: "string" } },
        progress: { type: "string" },
      },
    },
  });

  if (!result) return [];

  const items = [];
  const join = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join("; ") : "");

  if (join(result.insights)) items.push({ memory_type: "insight", memory_value: join(result.insights) });
  if (join(result.patterns)) items.push({ memory_type: "pattern", memory_value: join(result.patterns) });
  if (join(result.themes)) items.push({ memory_type: "theme", memory_value: join(result.themes) });
  if (result.progress) items.push({ memory_type: "progress", memory_value: result.progress });

  return items;
}