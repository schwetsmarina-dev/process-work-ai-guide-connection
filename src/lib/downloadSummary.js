import { format } from "date-fns";

const MODE_LABELS_RU = {
  body: "Работа с телом",
  dream: "Работа со сном",
  conflict: "Работа с конфликтом",
  journaling: "Свободное письмо",
};

// Build the plain-text summary content in the required format.
function buildSummaryText(session) {
  const modeKey = session.mode_id || session.mode;
  const modeName = MODE_LABELS_RU[modeKey] || modeKey || "";
  const dateStr = session.created_date
    ? format(new Date(session.created_date), "d MMM yyyy, HH:mm")
    : "";

  const lines = [];
  lines.push("=== РЕЗЮМЕ СЕССИИ ===");
  lines.push(`Дата: ${dateStr}`);
  lines.push(`Режим: ${modeName}`);
  lines.push("");
  lines.push("ИТОГ СЕССИИ:");
  lines.push(session.summary || "Резюме недоступно.");
  lines.push("");

  if (session.themes?.length > 0) {
    lines.push("ТЕМЫ:");
    session.themes.forEach((th) => lines.push(`- ${th}`));
    lines.push("");
  }

  if (session.signals?.length > 0) {
    lines.push("СИГНАЛЫ:");
    session.signals.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  if (session.next_step_suggestion) {
    lines.push("СЛЕДУЮЩИЙ ШАГ:");
    lines.push(session.next_step_suggestion);
    lines.push("");
  }

  lines.push("====================");
  return lines.join("\n");
}

// Download the session summary as a UTF-8 (with BOM) .txt file.
export function downloadSummaryTxt(session) {
  const text = buildSummaryText(session);
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