import { base44 } from "@/api/base44Client";

const SEMANTIC_LIMIT = 8;
const DYNAMIC_LIMIT = 5;
const EPISODIC_LIMIT = 7;

function usable(row) {
  return row?.is_active !== false && row?.excluded_from_ai !== true && row?.user_status !== "rejected";
}

function priority(row) {
  const reviewed = row.user_status === "corrected" ? 4 : row.user_status === "confirmed" ? 3 : 1;
  const importance = row.importance === "high" ? 2 : row.importance === "medium" ? 1 : 0;
  const confidence = Number(row.confidence || 0);
  return reviewed * 10 + importance * 2 + confidence;
}

// Return a compact, layered context instead of pushing the entire lifetime archive
// into every model call. Full episodic history remains stored in the database.
export async function loadUserMemories(userId) {
  if (!userId) return [];
  try {
    const rows = await base44.entities.UserMemory.filter({ user_id: userId }, "-updated_at", 500);
    const active = (rows || []).filter(usable);

    const semantic = active
      .filter((m) => m.memory_level === "semantic")
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, SEMANTIC_LIMIT);
    const dynamic = active
      .filter((m) => m.memory_level === "dynamic")
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, DYNAMIC_LIMIT);
    const episodic = active
      .filter((m) => !m.memory_level || m.memory_level === "episodic")
      .slice(0, EPISODIC_LIMIT);

    return [...semantic, ...dynamic, ...episodic];
  } catch (e) {
    console.error("[UserMemory] load failed:", e?.message);
    return [];
  }
}

const MEMORY_PREAMBLE = {
  ru: {
    intro: "Контекст из прошлых сессий. Это изменяемые наблюдения и гипотезы, а не факты о личности:",
    semantic: "Устойчивые гипотезы",
    dynamic: "Изменения во времени",
    episodic: "Недавние эпизоды",
    rule:
      "Используй только как мягкий контекст. Не превращай гипотезы в диагнозы или окончательные характеристики. " +
      "Если текущий опыт человека противоречит памяти, приоритет всегда у текущего опыта.",
  },
  es: {
    intro: "Contexto de sesiones anteriores. Son observaciones e hipótesis revisables, no hechos fijos sobre la persona:",
    semantic: "Hipótesis longitudinales",
    dynamic: "Cambios a lo largo del tiempo",
    episodic: "Episodios recientes",
    rule:
      "Úsalo solo como contexto suave. No conviertas hipótesis en diagnósticos ni rasgos fijos. " +
      "Si la experiencia actual contradice la memoria, la experiencia actual siempre tiene prioridad.",
  },
  en: {
    intro: "Context from previous sessions. These are revisable observations and hypotheses, not fixed facts about the person:",
    semantic: "Longitudinal hypotheses",
    dynamic: "Changes over time",
    episodic: "Recent episodes",
    rule:
      "Use this only as soft context. Do not turn hypotheses into diagnoses or fixed traits. " +
      "If current experience contradicts memory, current experience always takes priority.",
  },
};

export function formatMemoriesForPrompt(memories, language = "es") {
  if (!memories || memories.length === 0) return "";
  const copy = MEMORY_PREAMBLE[language] || MEMORY_PREAMBLE.es;
  const groups = {
    semantic: memories.filter((m) => m.memory_level === "semantic"),
    dynamic: memories.filter((m) => m.memory_level === "dynamic"),
    episodic: memories.filter((m) => !m.memory_level || m.memory_level === "episodic"),
  };

  const block = [];
  const add = (label, rows) => {
    if (!rows.length) return;
    block.push(`${label}:`);
    rows.forEach((m) => {
      const review = ["confirmed", "corrected"].includes(m.user_status) ? " [user-validated]" : "";
      const evidence = Number(m.evidence_count || 0) > 1 ? ` [evidence:${m.evidence_count}]` : "";
      const trend = m.trend ? ` [trend:${m.trend}]` : "";
      block.push(`- ${m.memory_key}: ${m.memory_value}${review}${evidence}${trend}`);
    });
  };

  add(copy.semantic, groups.semantic);
  add(copy.dynamic, groups.dynamic);
  add(copy.episodic, groups.episodic);
  return `\n\n${copy.intro}\n${block.join("\n")}\n${copy.rule}`;
}

// Kept for compatibility with older callers. New live sessions persist episodic
// memory through persistSessionMemory and rebuild longitudinal memory server-side.
/**
 * @param {string} userId
 * @param {Array<any>} items
 * @param {{sessionId?: string, modeId?: string}} opts
 */
export async function saveUserMemories(userId, items, opts = {}) {
  const { sessionId, modeId } = opts;
  if (!userId || !items?.length) return;
  const now = new Date().toISOString();
  for (const item of items) {
    if (!item.memory_value || !item.memory_key) continue;
    await base44.entities.UserMemory.create({
      user_id: userId,
      memory_level: "episodic",
      memory_type: item.memory_type || item.memory_key,
      memory_key: item.memory_key,
      memory_value: item.memory_value,
      source_session_id: sessionId,
      source_mode_id: modeId,
      evidence_session_ids: sessionId ? [sessionId] : [],
      evidence_count: sessionId ? 1 : 0,
      confidence: 0.65,
      importance: "medium",
      user_status: "unreviewed",
      excluded_from_ai: false,
      is_active: true,
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    });
  }
}
