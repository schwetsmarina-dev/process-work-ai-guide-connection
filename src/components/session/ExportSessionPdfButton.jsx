import { isSummaryUnavailable } from "@/lib/summaryFallback";
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import { t } from "@/lib/i18n";

const escapeHtml = (str) =>
  String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ExportSessionPdfButton({ session, messages = [], language = "ru" }) {
  const downloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const resolvedMode = session.mode_id || session.mode || "journaling";
    const modeName = MODE_LABELS[resolvedMode]?.[language] || MODE_LABELS[resolvedMode]?.ru || resolvedMode;
    const dateStr = session.created_date ? format(new Date(session.created_date), "d MMM yyyy, HH:mm") : "";
    const dialog = messages.filter((m) => m.role !== "system");

    const roleLabel = (role) =>
      role === "user" ? t("export_pdf_role_user", language) : t("export_pdf_role_assistant", language);

    const sections = [];

    if (session.summary && !isSummaryUnavailable(session.summary)) {
      sections.push(`
        <div class="section">
          <div class="section-title summary">${escapeHtml(t("export_pdf_section_summary", language))}</div>
          <div class="section-body">${escapeHtml(session.summary)}</div>
        </div>`);
    }

    if (session.themes?.length > 0 && !isSummaryUnavailable(session.summary)) {
      sections.push(`
        <div class="section">
          <div class="section-title themes">${escapeHtml(t("export_pdf_section_themes", language))}</div>
          <div class="section-body">${escapeHtml(session.themes.join(", "))}</div>
        </div>`);
    }

    if (session.signals?.length > 0 && !isSummaryUnavailable(session.summary)) {
      sections.push(`
        <div class="section">
          <div class="section-title signals">${escapeHtml(t("export_pdf_section_signals", language))}</div>
          <ul class="section-body">${session.signals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        </div>`);
    }

    if (session.next_step_suggestion) {
      sections.push(`
        <div class="section">
          <div class="section-title next">${escapeHtml(t("export_pdf_section_next", language))}</div>
          <div class="section-body">${escapeHtml(session.next_step_suggestion)}</div>
        </div>`);
    }

    if (dialog.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title dialog">${escapeHtml(t("export_pdf_section_dialog", language))}</div>
          ${dialog
            .map(
              (m) => `
              <div class="message ${m.role === "user" ? "user" : "assistant"}">
                <div class="role-label">${escapeHtml(roleLabel(m.role))}</div>
                <div class="content">${escapeHtml(m.content)}</div>
              </div>`
            )
            .join("")}
        </div>`);
    }

    const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>Talvira — ${escapeHtml(modeName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    /* 'Noto Sans' embeds full Cyrillic glyphs, so the exported PDF stays readable
       regardless of the OS/print-driver's default font (unlike the literal
       PostScript font 'Helvetica', which has no Cyrillic glyphs at all and was
       producing mojibake for Russian-language exports). */
    body { font-family: 'Noto Sans', -apple-system, 'Segoe UI', Arial, sans-serif;
           max-width: 720px; margin: 30px auto; padding: 0 20px;
           color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 22px; color: #46825f; margin-bottom: 2px; }
    .subtitle { color: #666; font-size: 14px; margin: 0 0 4px; }
    .meta { color: #999; font-size: 12px; border-bottom: 2px solid #46825f;
            padding-bottom: 10px; margin-bottom: 20px; }
    .section { margin-bottom: 18px; }
    .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase;
                     letter-spacing: 0.5px; color: #fff; padding: 5px 10px;
                     border-radius: 6px; display: inline-block; margin-bottom: 8px; }
    .section-title.summary { background: #46825f; }
    .section-title.themes  { background: #6e50a0; }
    .section-title.signals { background: #c89632; }
    .section-title.next    { background: #326ea0; }
    .section-title.dialog  { background: #646464; }
    .section-body { white-space: pre-wrap; }
    ul.section-body { padding-left: 20px; }
    .message { margin: 10px 0; padding: 10px 14px; border-radius: 10px;
               page-break-inside: avoid; }
    .message.user { background: #f5f5f5; border-left: 3px solid #888; }
    .message.assistant { background: #eef4ec; border-left: 3px solid #46825f; }
    .role-label { font-weight: bold; font-size: 11px; text-transform: uppercase;
                  margin-bottom: 4px; color: #555; }
    .content { white-space: pre-wrap; }
    .footer { color: #bbb; font-size: 11px; margin-top: 30px;
              border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { margin: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Talvira</h1>
  <p class="subtitle">${escapeHtml(t("export_pdf_report_title", language))}</p>
  <div class="meta">${escapeHtml(modeName)} &nbsp;·&nbsp; ${escapeHtml(dateStr)}</div>
  ${sections.join("")}
  <div class="footer">${escapeHtml(t("export_pdf_footer", language))}</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for the Noto Sans web font to finish loading before printing —
    // otherwise the browser may still be using a fallback font (some of which
    // lack Cyrillic glyphs) at the moment print() fires.
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      printWindow.print();
    };
    if (printWindow.document.fonts?.ready) {
      printWindow.document.fonts.ready.then(triggerPrint).catch(triggerPrint);
      setTimeout(triggerPrint, 1500); // safety fallback if fonts.ready never resolves
    } else {
      setTimeout(triggerPrint, 800);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5"
      onClick={downloadPDF}
    >
      <Download className="w-4 h-4 mr-2" />
      {t("export_pdf", language)}
    </Button>
  );
}