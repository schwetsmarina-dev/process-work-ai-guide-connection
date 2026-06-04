import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── 1. Russian term_id → latin_key (approved by user) ───────────────────────
// Keys are normalized: lowercased, "ё"→"е", collapsed whitespace, trimmed.
const RAW_MAP = {
  "Амплификация": "amplification",
  "Архитектура бизнеса": "business_architecture",
  "Аудиальный канал": "auditory_channel",
  "Безопасность": "safety",
  "Векторная работа": "vector_work",
  "Виды вторичных процессов": "secondary_process_types",
  "Визуальный канал": "visual_channel",
  "Внутренняя работа": "inner_work",
  "Внутренняя фигура / Часть / Роль": "inner_figure",
  "Всеобщее сновидящее тело": "collective_dreambody",
  "Вторичный процесс": "secondary_process",
  "Второе внимание": "second_attention",
  "Высший и низший сон": "high_low_dream",
  "Выход на вторичный процесс через разговор": "secondary_via_conversation",
  "Геопсихология": "geopsychology",
  "Глубинная демократия": "deep_democracy",
  "Двойной сигнал": "double_signal",
  "Двойная связь": "double_bind",
  "Интеграция": "integration",
  "Канал": "channel",
  "Кинестетический / Проприоцептивный канал": "proprioceptive_channel",
  "Кома": "coma",
  "Консенсусная реальность": "consensus_reality",
  "Контекстуальный ранг": "contextual_rank",
  "Край": "edge",
  "Краевая фигура": "edge_figure",
  "Лидерство": "leadership",
  "Личный миф": "personal_myth",
  "Маргинализация": "marginalization",
  "Мейнстрим": "mainstream",
  "Метакоммуникатор": "metacommunicator",
  "Метанавыки": "metaskills",
  "Мировая работа": "worldwork",
  "Мировое сновидящее тело": "world_dreambody",
  "Мировой канал": "world_channel",
  "Мифический уровень": "mythic_level",
  "Мифическое тело": "mythic_body",
  "Насновиживание": "dreaming_up",
  "Незанятый канал": "unoccupied_channel",
  "Непроявленное": "unmanifest",
  "Осознанность / Осознаваемость": "awareness",
  "Первичный процесс": "primary_process",
  "Поле": "field",
  "Процесс": "process",
  "Процессуальная работа": "process_work",
  "Процессуальный ум": "process_mind",
  "Психологический ранг": "psychological_rank",
  "Радужная медицина": "rainbow_medicine",
  "Ранг": "rank",
  "Расшифровка сновидений": "dream_decoding",
  "Роль-призрак": "ghost_role",
  "Самоактуализация в бизнесе": "self_actualization_business",
  "Сигнал": "signal",
  "Симметричные реакции": "symmetric_reactions",
  "Симптом": "symptom",
  "Слепой доступ": "empty_access",
  "Сновидение / Процесс сновидения": "dreaming",
  "Сновидение наяву": "waking_dream",
  "Сновидящее тело": "dreambody",
  "Создатель симптома": "symptom_maker",
  "Создатель сновидения": "dream_maker",
  "Социальные ритмы": "social_rhythms",
  "Социальный ранг": "social_rank",
  "Способы работы с краевыми фигурами": "edge_figure_methods",
  "Старейшинство": "eldership",
  "Сущностный уровень": "essence_level",
  "Телесный сигнал": "body_signal",
  "Фасилитация": "facilitation",
  "Фрейминг": "framing",
  "Сжигание дров": "burning_wood",
  "Духовный ранг": "spiritual_rank",
  "Духовный воин": "spiritual_warrior",
  "Жизненный миф": "life_myth",
  "Заигрывания / Флирты": "flirts",
  "Энергия U и X": "energy_u_x",
};

// Aliases: some term_id values carry an English suffix in parentheses or a
// slightly different wording. Normalize them to the canonical Russian key above.
const ALIAS = {
  "осознанность / осознаваемость (awareness)": "Осознанность / Осознаваемость",
  "внутренняя фигура / часть / роль (inner part / figure / role)": "Внутренняя фигура / Часть / Роль",
  "консенсусная реальность (cr)": "Консенсусная реальность",
  "метакоммуникатор (metacommunicator)": "Метакоммуникатор",
  "роль-призрак (ghost role)": "Роль-призрак",
  "сигнал (signal)": "Сигнал",
  "сжигание дров (burning wood)": "Сжигание дров",
  "слепой доступ (empty access)": "Слепой доступ",
  "сновидение / процесс сновидения (dreaming)": "Сновидение / Процесс сновидения",
  "старейшинство (eldership)": "Старейшинство",
};

function norm(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

// Build normalized lookup: normalized Russian → latin_key
const NORM_MAP = {};
for (const [ru, key] of Object.entries(RAW_MAP)) NORM_MAP[norm(ru)] = key;

function resolveLatinKey(termId) {
  const n = norm(termId);
  if (NORM_MAP[n]) return NORM_MAP[n];
  if (ALIAS[n]) return NORM_MAP[norm(ALIAS[n])];
  return null;
}

// ─── 2. ModeStep transliterated key → approved english key ───────────────────
const STEP_KEY_MAP = {
  pervichnyi_protsess: "primary_process",
  vtorichnyi_protsess: "secondary_process",
  krai: "edge",
  kanal: "channel",
  signal: "signal",
  telesnyi_signal: "body_signal",
  snovidenie_protsess_snovideniya: "dreaming",
  snovidenie: "dreaming",
  snovidenie_nayavu: "waking_dream",
  amplifikatsiya: "amplification",
  lichnyi_mif: "personal_myth",
  zhiznennyi_mif: "life_myth",
  mificheskii_uroven: "mythic_level",
  dvoinaya_svyaz: "double_bind",
  dvoinoi_signal: "double_signal",
  rang: "rank",
  bezopasnost: "safety",
  vnutrennyaya_figura_chast_rol: "inner_figure",
  rol_prizrak: "ghost_role",
  polyarnost: "polarity",
  osoznannost: "awareness",
  integratsiya: "integration",
  metakommunikator: "metacommunicator",
  konsensusnaya_realnost: "consensus_reality",
  pole: "field",
  protsess: "process",
  protsessualnaya_rabota: "process_work",
};

function remapStepKeys(value) {
  if (!value) return { value, changed: false };
  const parts = value.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  let changed = false;
  const mapped = parts.map((p) => {
    if (STEP_KEY_MAP[p]) { changed = true; return STEP_KEY_MAP[p]; }
    return p;
  });
  return { value: mapped.join("; "), changed };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false; // default to dry run for safety
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const report = {
    dryRun,
    terms: { total: 0, keyed: 0, unmatched: [], duplicatesDeleted: [] },
    modeSteps: { total: 0, updated: 0, changes: [] },
  };

  // ─── A. Assign latin_key to all terms ──────────────────────────────────────
  const terms = await base44.asServiceRole.entities.Term.list("term_id", 1000);
  report.terms.total = terms.length;

  // Group by latin_key to detect duplicates
  const byKey = {};
  for (const t of terms) {
    const latinKey = resolveLatinKey(t.term_id);
    if (!latinKey) {
      report.terms.unmatched.push(t.term_id);
      continue;
    }
    (byKey[latinKey] ||= []).push(t);
  }

  // Helper: pick the record with the longest short_definition (best definition)
  const bestOf = (records) =>
    [...records].sort(
      (a, b) => (b.short_definition?.length || 0) - (a.short_definition?.length || 0)
    )[0];

  for (const [latinKey, records] of Object.entries(byKey)) {
    const keep = bestOf(records);
    const dups = records.filter((r) => r.id !== keep.id);

    // Set latin_key on the kept record
    report.terms.keyed++;
    if (!dryRun) {
      await base44.asServiceRole.entities.Term.update(keep.id, { latin_key: latinKey });
    }

    // Delete duplicates
    for (const d of dups) {
      report.terms.duplicatesDeleted.push({ latin_key: latinKey, deleted_term_id: d.term_id, deleted_id: d.id, kept_id: keep.id });
      if (!dryRun) {
        await base44.asServiceRole.entities.Term.delete(d.id);
      }
    }
  }

  // ─── B. Remap ModeStep.related_term_ids ────────────────────────────────────
  const steps = await base44.asServiceRole.entities.ModeStep.list("step_number", 1000);
  report.modeSteps.total = steps.length;

  for (const s of steps) {
    const { value, changed } = remapStepKeys(s.related_term_ids);
    if (changed) {
      report.modeSteps.updated++;
      report.modeSteps.changes.push({ step_key: s.step_key, from: s.related_term_ids, to: value });
      if (!dryRun) {
        await base44.asServiceRole.entities.ModeStep.update(s.id, { related_term_ids: value });
      }
    }
  }

  // base64 the report so the test harness shows readable Cyrillic
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ success: true, ...report }))));
  return Response.json({ success: true, dryRun, unmatchedCount: report.terms.unmatched.length, duplicatesCount: report.terms.duplicatesDeleted.length, stepsUpdated: report.modeSteps.updated, b64 });
});