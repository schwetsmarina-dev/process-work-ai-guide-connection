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
// The wrapper text is part of the prompt, so it must be written in the session
// language — a Russian instruction block inside a Spanish conversation nudges
// the model to drift back into Russian.
const MEMORY_PREAMBLE = {
  ru: {
    intro: "Вот что известно об этом пользователе из прошлых сессий:",
    rule:
      "Учитывай это при работе, но не упоминай явно что ты «помнишь» — " +
      "просто используй как контекст.",
  },
  es: {
    intro: "Esto es lo que se sabe de esta persona por sesiones anteriores:",
    rule:
      "Tenlo en cuenta durante la sesión, pero no menciones explícitamente que lo " +
      "«recuerdas» — úsalo solo como contexto.",
  },
};

export function formatMemoriesForPrompt(memories, language = "ru") {
  if (!memories || memories.length === 0) return "";
  const copy = MEMORY_PREAMBLE[language] || MEMORY_PREAMBLE.ru;
  const lines = memories
    .map((m) => `${m.memory_key}: ${m.memory_value}`)
    .join("\n");
  return `\n\n${copy.intro}\n${lines}\n${copy.rule}`;
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

// ─── 4. (removed) Client-side session analysis ───────────────────────────────
// `extractMemoriesFromSession` used to analyze the transcript here and had no
// callers — the live implementation is the `persistSessionMemory` backend
// function, which already handles both languages and strips the subject from
// each phrase. Keeping a second copy on the client meant two prompts drifting
// apart, with only the backend one actually running.
