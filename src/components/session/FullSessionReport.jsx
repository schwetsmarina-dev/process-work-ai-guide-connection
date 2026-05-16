import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Zap, GitBranch, ListChecks, ChevronDown, ChevronUp, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

const MODE_LABELS_RU = {
  body: "Работа с телом",
  dream: "Работа со сном",
  conflict: "Работа с конфликтом",
  journaling: "Свободное письмо",
};

export default function FullSessionReport({ session, messages }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const downloadPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addText = (text, opts = {}) => {
      const { size = 10, bold = false, color = [60, 60, 60], indent = 0 } = opts;
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text || ""), maxW - indent);
      if (y + lines.length * (size * 0.4 + 1) > 275) { doc.addPage(); y = 20; }
      doc.text(lines, margin + indent, y);
      y += lines.length * (size * 0.4 + 1) + 1;
    };

    const addSection = (title, color = [80, 80, 80]) => {
      y += 5;
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFillColor(...color);
      doc.rect(margin, y - 4, maxW, 8, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, y + 1);
      y += 9;
      doc.setTextColor(60, 60, 60);
    };

    const addLine = () => {
      y += 2;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    };

    // Title
    addText("Inner Process Path", { size: 18, bold: true, color: [70, 130, 100] });
    addText("Отчёт о сессии", { size: 13, bold: false, color: [100, 100, 100] });
    y += 2;

    // Meta
    const modeName = MODE_LABELS_RU[session.mode_id || session.mode] || (session.mode_id || session.mode);
    const dateStr = session.created_date ? format(new Date(session.created_date), "d MMM yyyy, HH:mm") : "";
    addText(`Режим: ${modeName}   |   Дата: ${dateStr}`, { size: 9, color: [130, 130, 130] });
    addLine();

    // Session summary (from session entity)
    if (session.summary && session.summary !== "Сессия завершена. Резюме недоступно.") {
      addSection("Краткое резюме", [70, 130, 100]);
      addText(session.summary, { size: 10 });
    }

    // Key signals
    if (report.key_signals?.length > 0) {
      addSection("Ключевые сигналы", [200, 150, 50]);
      report.key_signals.forEach((s) => addText(`• ${s}`, { size: 10, indent: 3 }));
    }

    // Polarities
    if (report.polarities?.length > 0) {
      addSection("Выявленные полярности", [110, 80, 160]);
      report.polarities.forEach((p, i) => {
        addText(`${i + 1}. ${p.primary}  ↔  ${p.secondary}`, { size: 10, bold: true, indent: 3, color: [90, 60, 140] });
        if (p.tension) addText(p.tension, { size: 9, indent: 6, color: [120, 100, 160] });
        y += 1;
      });
    }

    // Self-work plan
    if (report.self_work_plan?.length > 0) {
      addSection("План самостоятельной работы", [50, 110, 160]);
      report.self_work_plan.forEach((item, i) => {
        addText(`${i + 1}. ${item.practice}`, { size: 10, bold: true, indent: 3 });
        if (item.how) addText(item.how, { size: 9, indent: 6, color: [100, 100, 100] });
        y += 1;
      });
    }

    // Closing reflection
    if (report.closing_reflection) {
      addSection("Завершающее отражение", [100, 100, 100]);
      addText(report.closing_reflection, { size: 10, color: [80, 80, 80] });
    }

    // Footer
    y = doc.internal.pageSize.getHeight() - 12;
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text("Inner Process Path · Сгенерировано автоматически", margin, y);

    const filename = `session-report-${session.id?.slice(0, 8) || "export"}.pdf`;
    doc.save(filename);
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
          Сгенерировать полное резюме сессии
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
                    onClick={downloadPDF}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Скачать отчёт (PDF)
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