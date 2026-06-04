import { base44 } from "@/api/base44Client";

const MEMORY_LIMIT = 20;

// ─── 1. Load all active memories for the current user ────────────────────────
export async function loadUserMemories(userId) {
  if (!userId) return [];
  try {
    const rows = await base44.entities.UserMemory.filter(
      { user_id: userId, is_active: true },
      "-updated_at",
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
    .map((m) => `${m.memory_key}: ${m.memory_value}`)
    .join("\n");
  return (
    `\n\nВот что известно об этом пользователе из прошлых сессий:\n${lines}\n` +
    `Учитывай это при работе, но не упоминай явно что ты «помнишь» — ` +
    `просто используй как контекст.`
  );
}

// ─── 3. Save memories: dedupe by memory_key, deactivate oldest over limit ────
// items: [{ memory_type, memory_key, memory_value }]
export async function saveUserMemories(userId, items, { sessionId, modeId } = {}) {
  if (!userId || !items || items.length === 0) return;

  const existing = await base44.entities.UserMemory.filter({ user_id: userId });
  // newest record per memory_key (update target)
  const byKey = {};
  for (const row of existing) {
    const prev = byKey[row.memory_key];
    if (!prev || new Date(row.updated_at || row.created_date) > new Date(prev.updated_at || prev.created_date)) {
      byKey[row.memory_key] = row;
    }
  }

  const now = new Date().toISOString();

  for (const item of items) {
    if (!item.memory_value || !item.memory_key) continue;
    const target = byKey[item.memory_key];
    if (target) {
      // Update existing record with same memory_key
      await base44.entities.UserMemory.update(target.id, {
        memory_value: item.memory_value,
        memory_type: item.memory_type || target.memory_type,
        source_session_id: sessionId,
        source_mode_id: modeId,
        importance: "medium",
        is_active: true,
        updated_at: now,
      });
    } else {
      // Create new record
      await base44.entities.UserMemory.create({
        user_id: userId,
        memory_type: item.memory_type || item.memory_key,
        memory_key: item.memory_key,
        memory_value: item.memory_value,
        source_session_id: sessionId,
        source_mode_id: modeId,
        importance: "medium",
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // ─── Enforce limit: deactivate oldest active records beyond MEMORY_LIMIT ───
  const active = await base44.entities.UserMemory.filter(
    { user_id: userId, is_active: true },
    "-updated_at",
    200
  );
  if (active.length > MEMORY_LIMIT) {
    const toDeactivate = active.slice(MEMORY_LIMIT);
    for (const row of toDeactivate) {
      await base44.entities.UserMemory.update(row.id, { is_active: false });
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
    prompt: `Проанализируй эту сессию процессуально-ориентированной психологии.
Выдай ТОЛЬКО JSON, без пояснений, без markdown:
{
  "insights": ["ключевое открытие 1", "ключевое открытие 2"],
  "patterns": ["паттерн поведения или реакции"],
  "themes": ["повторяющаяся тема"],
  "body_signals": ["телесные сигналы если упоминались"],
  "edge": "описание края если был обнаружен или null",
  "progress": "в чём продвинулся пользователь одной фразой"
}

Сессия:
${conversation}`,
    response_json_schema: {
      type: "object",
      properties: {
        insights: { type: "array", items: { type: "string" } },
        patterns: { type: "array", items: { type: "string" } },
        themes: { type: "array", items: { type: "string" } },
        body_signals: { type: "array", items: { type: "string" } },
        edge: { type: ["string", "null"] },
        progress: { type: "string" },
      },
    },
  });

  if (!result) return [];

  const items = [];
  const join = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join("; ") : "");

  const insights = join(result.insights);
  const patterns = join(result.patterns);
  const themes = join(result.themes);
  const bodySignals = join(result.body_signals);

  if (insights) items.push({ memory_type: "insight", memory_key: "insights", memory_value: insights });
  if (patterns) items.push({ memory_type: "pattern", memory_key: "patterns", memory_value: patterns });
  if (themes) items.push({ memory_type: "theme", memory_key: "themes", memory_value: themes });
  if (bodySignals) items.push({ memory_type: "body_signal", memory_key: "body_signals", memory_value: bodySignals });
  if (result.edge && result.edge !== "null") items.push({ memory_type: "edge", memory_key: "edge", memory_value: result.edge });
  if (result.progress) items.push({ memory_type: "progress", memory_key: "progress", memory_value: result.progress });

  return items;
}