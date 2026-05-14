import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Zap, GitBranch, ListChecks, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FullSessionReport({ session, messages }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const generate = async () => {
    setLoading(true);
    const conversation = messages
      .filter((m) => m.role !== "system")
      .slice(-20)
      .map((m) => `${m.role === "user" ? "П" : "А"}: ${m.content}`)
      .join("\n");

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
    setLoading(false);
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

                {/* Regenerate */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs w-full"
                  onClick={generate}
                >
                  Сгенерировать заново
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}