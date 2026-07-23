import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Zap, GitBranch, ListChecks, ChevronDown, ChevronUp, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import { MODE_LABELS } from "@/lib/modeSteps";
import { isSummaryUnavailable } from "@/lib/summaryFallback";
import { downloadSummaryTxt } from "@/lib/downloadSummary";

const escapeHtml = (str) =>
  String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function FullSessionReport({ session, messages, lang = "ru" }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const downloadPDF = () => {
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const modeName = MODE_LABELS[session.mode_id || session.mode]?.[lang] || (session.mode_id || session.mode);
    const dateStr = session.created_date ? format(new Date(session.created_date), "d MMM yyyy, HH:mm") : "";

    const sections = [];

    if (session.summary && !isSummaryUnavailable(session.summary)) {
      sections.push(`
        <div class="section">
          <div class="section-title summary">${escapeHtml(t("report_summary_short", lang))}</div>
          <div class="section-body">${escapeHtml(session.summary)}</div>
        </div>`);
    }

    if (report.key_signals?.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title signals">${escapeHtml(t("report_signals", lang))}</div>
          <ul class="section-body">${report.key_signals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        </div>`);
    }

    if (report.polarities?.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title polarities">${escapeHtml(t("report_polarities", lang))}</div>
          ${report.polarities
            .map(
              (p, i) => `
              <div class="polarity">
                <div class="polarity-head">${i + 1}. ${escapeHtml(p.primary)} ↔ ${escapeHtml(p.secondary)}</div>
                ${p.tension ? `<div class="polarity-tension">${escapeHtml(p.tension)}</div>` : ""}
              </div>`
            )
            .join("")}
        </div>`);
    }

    if (report.self_work_plan?.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title plan">${escapeHtml(t("report_plan", lang))}</div>
          ${report.self_work_plan
            .map(
              (item, i) => `
              <div class="plan-item">
                <div class="plan-practice">${i + 1}. ${escapeHtml(item.practice)}</div>
                ${item.how ? `<div class="plan-how">${escapeHtml(item.how)}</div>` : ""}
              </div>`
            )
            .join("")}
        </div>`);
    }

    if (report.closing_reflection) {
      sections.push(`
        <div class="section">
          <div class="section-title reflection">${escapeHtml(t("report_reflection", lang))}</div>
          <div class="section-body">${escapeHtml(report.closing_reflection)}</div>
        </div>`);
    }

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Inner Process Path — ${escapeHtml(modeName)}</title>
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
    .section-title.summary    { background: #46825f; }
    .section-title.signals    { background: #c89632; }
    .section-title.polarities { background: #6e50a0; }
    .section-title.plan       { background: #326ea0; }
    .section-title.reflection { background: #646464; }
    .section-body { white-space: pre-wrap; }
    ul.section-body { padding-left: 20px; }
    .polarity { margin: 8px 0; padding: 8px 12px; background: #f4f1fa;
                border-left: 3px solid #6e50a0; border-radius: 8px; page-break-inside: avoid; }
    .polarity-head { font-weight: bold; color: #5a3f8f; }
    .polarity-tension { font-size: 13px; color: #888; font-style: italic; margin-top: 2px; }
    .plan-item { margin: 8px 0; page-break-inside: avoid; }
    .plan-practice { font-weight: bold; }
    .plan-how { color: #666; font-size: 14px; margin-top: 2px; }
    .footer { color: #bbb; font-size: 11px; margin-top: 30px;
              border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { margin: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Inner Process Path</h1>
  <p class="subtitle">${escapeHtml(t("report_subtitle", lang))}</p>
  <div class="meta">${escapeHtml(t("report_mode", lang))}: ${escapeHtml(modeName)} &nbsp;·&nbsp; ${escapeHtml(dateStr)}</div>
  ${sections.join("")}
  <div class="footer">Inner Process Path · ${escapeHtml(t("report_footer", lang))}</div>
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

  const [generateError, setGenerateError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setGenerateError(null);
    const conversation = messages
      .filter((m) => m.role !== "system")
      .slice(-20)
      .map((m) => `${m.role === "user" ? "U" : "A"}: ${m.content}`)
      .join("\n");

    try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an experienced Process Work facilitator. Analyze the completed session and produce a structured report.

Session mode: ${session.mode_id || session.mode}

Transcript:
${conversation}

${lang === "es" ? "Escribe el informe EN ESPAÑOL, con un tono cálido y profesional. Usa las palabras e imágenes concretas de la conversación." : "Напиши отчёт на русском языке, тёплым профессиональным тоном. Используй конкретные слова и образы из разговора."}`,
      response_json_schema: {
        type: "object",
        properties: {
          key_signals: {
            type: "array",
            description: "3-5 key signals noticed in the session (bodily, imaginal, emotional)",
            items: { type: "string" }
          },
          polarities: {
            type: "array",
            description: "2-3 polarities or inner contradictions identified",
            items: {
              type: "object",
              properties: {
                primary: { type: "string", description: "Primary pole (familiar, stable)" },
                secondary: { type: "string", description: "Secondary pole (new, charged, alive)" },
                tension: { type: "string", description: "The essence of the tension between them" }
              }
            }
          },
          self_work_plan: {
            type: "array",
            description: "3-5 concrete practices for self-guided work between sessions",
            items: {
              type: "object",
              properties: {
                practice: { type: "string", description: "Name of the practice or exercise" },
                how: { type: "string", description: "How exactly to do it (1-2 sentences)" }
              }
            }
          },
          closing_reflection: {
            type: "string",
            description: "A short closing reflection (2-3 sentences) on what mattered most in the session"
          }
        }
      }
    });

      setReport(result);
    } catch (err) {
      console.error("[FullSessionReport] generate failed:", err);
      setGenerateError(t("report_error", lang));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      {!report && !loading && (
        <Button
          variant="outline"
          className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5"
          onClick={generate}
        >
          <FileText className="w-4 h-4 mr-2" />
          {isSummaryUnavailable(session.summary)
            ? t("report_generate_summary_pdf", lang)
            : t("report_generate_full", lang)}
        </Button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("report_analyzing", lang)}
        </div>
      )}

      {generateError && !loading && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
          <p className="text-sm text-destructive">{generateError}</p>
          <Button size="sm" variant="outline" onClick={generate}>{t("retry", lang)}</Button>
        </div>
      )}

      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{t("report_full_title", lang)}</span>
              </div>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>

            {open && (
              <div className="space-y-4">
                {/* Key Signals */}
                {report.key_signals?.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h4 className="font-semibold text-sm">{t("report_signals", lang)}</h4>
                    </div>
                    <ul className="space-y-2">
                      {report.key_signals.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Polarities */}
                {report.polarities?.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-violet-500" />
                      <h4 className="font-semibold text-sm">{t("report_polarities", lang)}</h4>
                    </div>
                    <div className="space-y-3">
                      {report.polarities.map((p, i) => (
                        <div key={i} className="text-sm rounded-lg bg-violet-50 border border-violet-100 p-3 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-violet-700">{p.primary}</span>
                            <span className="text-muted-foreground">↔</span>
                            <span className="font-medium text-violet-700">{p.secondary}</span>
                          </div>
                          {p.tension && (
                            <p className="text-xs text-muted-foreground italic">{p.tension}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Self-work plan */}
                {report.self_work_plan?.length > 0 && (
                  <Card className="p-5 border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-sm">{t("report_plan", lang)}</h4>
                    </div>
                    <div className="space-y-3">
                      {report.self_work_plan.map((item, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium text-foreground">{i + 1}. {item.practice}</p>
                          <p className="text-muted-foreground mt-0.5">{item.how}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Closing reflection */}
                {report.closing_reflection && (
                  <Card className="p-5">
                    <p className="text-sm leading-relaxed text-muted-foreground italic">
                      {report.closing_reflection}
                    </p>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 rounded-xl"
                    onClick={() => downloadSummaryTxt(session, lang)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {t("download_txt", lang)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl"
                    onClick={downloadPDF}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={generate}
                  >
                    {t("again", lang)}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}