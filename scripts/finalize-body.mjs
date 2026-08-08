import fs from 'node:fs';

const aiPath = 'src/lib/sessionAI.js';
let ai = fs.readFileSync(aiPath, 'utf8');

const relatedFn = `async function fetchRelatedTerms(relatedTermIds) {
  if (!relatedTermIds) return [];
  const ids = relatedTermIds.split(";").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return [];
  const results = await Promise.all(
    ids.map((tid) => base44.entities.Term.filter({ term_id: tid }))
  );
  return results.flat();
}`;

const bodyChannelsFn = `${relatedFn}

// BODY CHANNELS: authoritative channel definitions come from the Term table, not hardcoded prompt theory.
// We load all Term rows and select the six Process Work channels by name/key/tags/aliases.
async function fetchBodyChannelTerms() {
  let all = [];
  try {
    all = await base44.entities.Term.list("term", 500);
  } catch (e) {
    console.error(\`[BODY_CHANNEL_TERMS] Term.list failed: \${e.message}\`);
    return [];
  }

  const channelGroups = [
    ["visual", "визуаль", "visual channel", "канал зрения"],
    ["propriocept", "проприоцеп", "proprioceptive channel", "телесный канал"],
    ["auditory", "аудиаль", "слухов", "auditory channel"],
    ["relationship", "отношен", "relationship channel", "relational"],
    ["movement", "движен", "movement channel", "kinesthetic"],
    ["world", "миров", "world channel", "канал мира"],
  ];

  const haystack = (t) => [
    t.term, t.term_id, t.latin_key, t.category, t.short_definition,
    t.practical_application, t.related_terms, t.search_tags, t.aliases, t.notes,
  ].filter(Boolean).join(" ").toLowerCase();

  const selected = [];
  for (const group of channelGroups) {
    const hit = all.find((t) => group.some((needle) => haystack(t).includes(needle)));
    if (hit && !selected.some((x) => x.id === hit.id || x.term_id === hit.term_id)) selected.push(hit);
  }

  console.log("[BODY_CHANNEL_TERMS]", {
    found: selected.length,
    channels: selected.map((t) => t.term || t.latin_key || t.term_id),
  });
  return selected;
}`;

if (!ai.includes('async function fetchBodyChannelTerms()')) {
  if (!ai.includes(relatedFn)) throw new Error('fetchRelatedTerms block not found');
  ai = ai.replace(relatedFn, bodyChannelsFn);
}

const oldTerms = `  const terms = await fetchRelatedTerms(step?.related_term_ids);`;
const newTerms = `  const terms = modeKey === "body"
    ? await fetchBodyChannelTerms()
    : await fetchRelatedTerms(step?.related_term_ids);`;
if (ai.includes(oldTerms)) ai = ai.replace(oldTerms, newTerms);
else if (!ai.includes('modeKey === "body"\n    ? await fetchBodyChannelTerms()')) throw new Error('terms loading block not found');

const oldHeader = `    ? "\\n\\nРелевантные концепции Process Work (используй ТОЛЬКО внутренне, чтобы выбрать правильный тип вмешательства):\\n" +`;
const newHeader = `    ? (modeKey === "body"
        ? "\\n\\nШЕСТЬ КАНАЛОВ PROCESS WORK — определения загружены из таблицы Term. Используй их внутренне при разворачивании образа X; канал описывает способ восприятия/проявления образа и НЕ заменяет сам образ:\\n"
        : "\\n\\nРелевантные концепции Process Work (используй ТОЛЬКО внутренне, чтобы выбрать правильный тип вмешательства):\\n") +`;
if (ai.includes(oldHeader)) ai = ai.replace(oldHeader, newHeader);
else if (!ai.includes('ШЕСТЬ КАНАЛОВ PROCESS WORK')) throw new Error('terms context header not found');

fs.writeFileSync(aiPath, ai);
