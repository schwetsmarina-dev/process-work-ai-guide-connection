// Canonical "summary could not be generated" marker.
//
// This string is not just UI copy — it is written into Session.summary and then
// compared against in several screens to decide whether to render the summary
// block at all. Translating it naively breaks those comparisons silently, so
// the value is centralized here:
//
//   • getSummaryUnavailableText(lang) — what to STORE and SHOW, per language
//   • isSummaryUnavailable(summary)   — the check, tolerant of every variant
//                                        ever written, including legacy rows
//
// Never compare Session.summary against a literal again.

const VARIANTS = {
  ru: "Сессия завершена. Резюме недоступно.",
  es: "Sesión finalizada. El resumen no está disponible.",
};

// Every value that has ever been stored, so historical Russian-only rows keep
// being recognized after Spanish sessions start writing their own variant.
const ALL_VARIANTS = Object.values(VARIANTS);

export function getSummaryUnavailableText(lang) {
  return VARIANTS[lang] || VARIANTS.ru;
}

export function isSummaryUnavailable(summary) {
  if (!summary) return true;
  const s = String(summary).trim();
  return ALL_VARIANTS.some((v) => s === v);
}

// Legacy alias — kept so older imports do not break.
export const SUMMARY_UNAVAILABLE = VARIANTS.ru;
