import { format } from "date-fns";
import { t, getStoredLanguage } from "@/lib/i18n";
import { MODE_LABELS } from "@/lib/modeSteps";

// Build the plain-text summary content in the required format.
function buildSummaryText(session, lang) {
  const modeKey = session.mode_id || session.mode;
  const modeName = MODE_LABELS[modeKey]?.[lang] || modeKey || "";
  const dateStr = session.created_date
    ? format(new Date(session.created_date), "d MMM yyyy, HH:mm")
    : "";

  const lines = [];
  lines.push(t("dl_header", lang));
  lines.push(`${t("dl_date", lang)}: ${dateStr}`);
  lines.push(`${t("dl_mode", lang)}: ${modeName}`);
  lines.push("");
  lines.push(t("dl_result", lang));
  lines.push(session.summary || t("dl_unavailable", lang));
  lines.push("");

  if (session.themes?.length > 0) {
    lines.push(t("dl_themes", lang));
    session.themes.forEach((th) => lines.push(`- ${th}`));
    lines.push("");
  }

  if (session.signals?.length > 0) {
    lines.push(t("dl_signals", lang));
    session.signals.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  if (session.next_step_suggestion) {
    lines.push(t("dl_next", lang));
    lines.push(session.next_step_suggestion);
    lines.push("");
  }

  lines.push("====================");
  return lines.join("\n");
}

// Download the session summary as a UTF-8 (with BOM) .txt file.
export function downloadSummaryTxt(session, lang = getStoredLanguage()) {
  const text = buildSummaryText(session, lang);
  const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });

  const dateForName = session.created_date
    ? format(new Date(session.created_date), "yyyy-MM-dd")
    : "export";
  const modeForName = session.mode_id || session.mode || "session";
  const filename = `session_${dateForName}_${modeForName}.txt`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}