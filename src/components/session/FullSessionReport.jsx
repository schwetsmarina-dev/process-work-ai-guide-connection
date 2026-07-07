import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Zap, GitBranch, ListChecks, ChevronDown, ChevronUp, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { downloadSummaryTxt } from "@/lib/downloadSummary";

const MODE_LABELS_RU = {
  body: "Работа с телом",
  dream: "Работа со сном",
  conflict: "Работа с конфликтом",
  journaling: "Свободное письмо",
};

const escapeHtml = (str) =>
  String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function FullSessionReport({ session, messages }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const downloadPDF = () => {
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const modeName = MODE_LABELS_RU[session.mode_id || session.mode] || (session.mode_id || session.mode);
    const dateStr = session.created_date ? format(new Date(session.created_date), "d MMM yyyy, HH:mm") : "";

    const sections = [];

    if (session.summary && session.summary !== "Сессия завершена. Резюме недоступно.") {
      sections.push(`
        <div class="section">
          <div class="section-title summary">Краткое резюме</div>
          <div class="section-body">${escapeHtml(session.summary)}</div>
        </div>`);
    }

    if (report.key_signals?.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title signals">Ключевые сигналы</div>
          <ul class="section-body">${report.key_signals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        </div>`);
    }

    if (report.polarities?.length > 0) {
      sections.push(`
        <div class="section">
          <div class="section-title polarities">Выявленные полярности</div>
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
          <div class="section-title plan">План самостоятельной работы</div>
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
          <div class="section-title reflection">Завершающее отражение</div>
          <div class="section-body">${escapeHtml(report.closing_reflection)}</div>
        </div>`);
    }

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Inner Process Path — ${escapeHtml(modeName)}</title>
  <style>
    body { font-family: -apple-system, Arial, Helvetica, sans-serif;
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
  <p class="subtitle">Отчёт о сессии</p>
  <div class="meta">Режим: ${escapeHtml(modeName)} &nbsp;·&nbsp; ${escapeHtml(dateStr)}</div>
  ${sections.join("")}
  <div class="footer">Inner Process Path · Сгенерировано автоматически</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const [generateError, setGenerateError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setGenerateError(null);
    const conversation = messages
      .filter((m) => m.role !== "system")
      .slice(-20)
      .map((m) => `${m.role === "user" ? "П" : "А"}: ${m.content}`)
      .join("\n");

    try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Ты — опытный Process Work фасилитатор. Проанализируй завершённую сессию и создай структурированный отчёт.

Режим сессии: ${session.mode_id || session.mode}

Диалог:
${conversation}

Напиши отчёт на русском языке, тёплым профессиональным тоном. Используй конкретные слова и образы из разговора.`,
      response_json_schema: {
        type: "object",
        properties: {
          key_signals: {
            type: "array",
            description: "3–5 ключевых сигналов, замеченных в сессии (телесные, образные, эмоциональные)",
            items: { type: "string" }
          },
          polarities: {
            type: "array",
            description: "2–3 выявленные полярности или внутренние противоречия",
            items: {
              type: "object",
              properties: {
                primary: { type: "string", description: "Первичный полюс (знакомое, устойчивое)" },
                secondary: { type: "string", description: "Вторичный полюс (новое, напряжённое, живое)" },
                tension: { type: "string", description: "Суть напряжения между ними" }
              }
            }
          },
          self_work_plan: {
            type: "array",
            description: "3–5 конкретных практик для самостоятельной работы между сессиями",
            items: {
              type: "object",
              properties: {
                practice: { type: "string", description: "Название практики или упражнения" },
                how: { type: "string", description: "Как именно это делать (1–2 предложения)" }
              }
            }
          },
          closing_reflection: {
            type: "string",
            description: "Короткое завершающее отражение (2–3 предложения) о главном, что открылось в сессии"
          }
        }
      }
    });

      setReport(result);
    } catch (err) {
      console.error("[FullSessionReport] generate failed:", err);
      setGenerateError("Не удалось сгенерировать отчёт. Попробуйте ещё раз.");
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
          {session.summary === "Сессия завершена. Резюме недоступно."
            ? "Сгенерировать резюме и PDF"
            : "Сгенерировать полное резюме сессии"}
        </Button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Анализируем сессию…
        </div>
      )}

      {generateError && !loading && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
          <p className="text-sm text-destructive">{generateError}</p>
          <Button size="sm" variant="outline" onClick={generate}>Повторить</Button>
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
                <span className="font-semibold text-sm">Полное резюме сессии</span>
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
                      <h4 className="font-semibold text-sm">Ключевые сигналы</h4>
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
                      <h4 className="font-semibold text-sm">Выявленные полярности</h4>
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
                      <h4 className="font-semibold text-sm">План самостоятельной работы</h4>
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
                    onClick={() => downloadSummaryTxt(session)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Скачать (TXT)
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
                    Заново
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