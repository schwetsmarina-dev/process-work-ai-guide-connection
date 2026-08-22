import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CalendarRange, Loader2, ShieldCheck } from "lucide-react";

const COPY = {
  ru: {
    eyebrow: "28-дневная программа",
    title: "Безопасное возвращение к себе",
    body: "Если персональная практика уже опирается на устойчиво повторяющийся материал, Talvira может предложить более длинный цикл исследования края и саморегуляции. Перед стартом нужен короткий скрининг.",
    start: "Проверить готовность",
    screeningTitle: "Перед началом программы",
    screeningBody: "Это не клиническая оценка. Вопросы помогают Talvira не запускать самостоятельную глубокую практику в неподходящий момент.",
    q1: "Сейчас у меня есть острое кризисное состояние или ощущение, что я не справляюсь самостоятельно.",
    q2: "В последнее время у меня были выраженные эпизоды диссоциации, потери контакта с происходящим или сильной дереализации.",
    q3: "Самостоятельные глубокие практики заметно ухудшают моё состояние.",
    q4: "У меня есть человек или специалист, к которому я могу обратиться за живой поддержкой при необходимости.",
    q5: "Я понимаю, что могу остановить программу, сделать паузу или вернуться к более простому шагу в любой момент.",
    submit: "Продолжить",
    proceed: "Скрининг завершён. Программа может начаться с мягкого первого дня.",
    caution: "Talvira предлагает пока не начинать цикл автоматически. Лучше сначала обеспечить живую поддержку и вернуться к программе позже.",
    stop: "Сейчас программу лучше не начинать. Можно продолжать обычные сессии Talvira и вернуться к этому формату позже.",
    continueProgram: "Продолжить программу",
    openProgram: "Открыть программу",
    rescreen: "Повторить проверку готовности",
    existingActive: "Твоя 28-дневная программа уже начата. Продолжай с того места, где остановилась.",
    existingPaused: "Программа стоит на паузе. Место сохранено — можно вернуться к ней, когда захочешь.",
    cautionExisting: "Перед продолжением глубокой части нужно повторить короткую проверку готовности. Ресурсный день и день отдыха остаются доступны.",
  },
  es: {
    eyebrow: "Programa de 28 días",
    title: "Regreso seguro a ti",
    body: "Cuando una práctica personal ya se apoya en material recurrente, Talvira puede ofrecer un ciclo más largo para explorar el borde y la autorregulación. Antes de empezar hay un breve screening.",
    start: "Comprobar preparación",
    screeningTitle: "Antes de empezar",
    screeningBody: "No es una evaluación clínica. Estas preguntas ayudan a evitar iniciar una práctica profunda autoguiada en un momento poco adecuado.",
    q1: "Ahora mismo estoy en una crisis aguda o siento que no puedo manejar la situación sin ayuda.",
    q2: "Recientemente he tenido episodios intensos de disociación, desconexión o desrealización.",
    q3: "Las prácticas profundas por mi cuenta empeoran claramente mi estado.",
    q4: "Tengo una persona o profesional a quien puedo recurrir para apoyo humano si lo necesito.",
    q5: "Entiendo que puedo detener el programa, pausarlo o volver a un paso más sencillo en cualquier momento.",
    submit: "Continuar",
    proceed: "Screening completado. El programa puede empezar con un primer día suave.",
    caution: "Talvira recomienda no iniciar el ciclo automáticamente todavía. Conviene asegurar apoyo humano y volver al programa más adelante.",
    stop: "Ahora es mejor no iniciar el programa. Puedes continuar con las sesiones habituales de Talvira y volver a este formato más adelante.",
    continueProgram: "Continuar programa",
    openProgram: "Abrir programa",
    rescreen: "Repetir comprobación",
    existingActive: "Tu programa de 28 días ya está en marcha. Puedes continuar desde donde lo dejaste.",
    existingPaused: "El programa está en pausa. Tu lugar está guardado y puedes volver cuando quieras.",
    cautionExisting: "Antes de continuar con la parte profunda, repite la breve comprobación de preparación. El día de recursos y el día de descanso siguen disponibles.",
  },
};

export default function EdgeProgramOfferCard({ lang = "es", enabled = true }) {
  const c = COPY[lang] || COPY.ru;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({
    current_crisis: false,
    recent_dissociation: false,
    practice_worsens_state: false,
    has_human_support: false,
    understands_can_stop: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const { data: readiness, isLoading } = useQuery({
    queryKey: ["edge-program-readiness"],
    queryFn: async () => {
      const res = await base44.functions.invoke("checkEdgeProgramReadiness", {});
      return res?.data || {};
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!enabled || isLoading) return null;

  const existingProgram = readiness?.program || null;
  const canScreen = readiness?.eligible_to_screen === true;
  if (!canScreen && !existingProgram) return null;

  const setAnswer = (key, checked) => setAnswers((prev) => ({ ...prev, [key]: checked === true }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("submitEdgeProgramScreening", answers);
      setResult(res?.data || null);
      await queryClient.invalidateQueries({ queryKey: ["edge-program-readiness"] });
    } finally {
      setSubmitting(false);
    }
  };

  const resultText = result?.result === "proceed" ? c.proceed : result?.result === "caution" ? c.caution : result?.result === "stop" ? c.stop : "";

  if (existingProgram && !canScreen) {
    const active = existingProgram.status === "active";
    return (
      <Card className="p-5 md:p-6 border-primary/20 bg-card">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <CalendarRange className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">{c.eyebrow}</p>
            <h3 className="font-serif text-xl font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{active ? c.existingActive : c.existingPaused}</p>
            <Button variant="outline" onClick={() => navigate("/edge-program")}>
              <CalendarRange className="w-4 h-4 mr-2" />
              {c.continueProgram}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 md:p-6 border-primary/20 bg-card">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <CalendarRange className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">{c.eyebrow}</p>
            <h3 className="font-serif text-xl font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{c.body}</p>
            {readiness.theme_label && <p className="text-sm mb-4"><span className="font-medium">{readiness.theme_label}</span></p>}
            {readiness?.reason === "rescreen_caution" && <p className="text-sm text-amber-800 mb-4">{c.cautionExisting}</p>}
            <Button variant="outline" onClick={() => { setResult(null); setOpen(true); }}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              {readiness?.reason === "rescreen_caution" ? c.rescreen : c.start}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{c.screeningTitle}</DialogTitle>
            <DialogDescription>{c.screeningBody}</DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4">
              {[
                ["current_crisis", c.q1],
                ["recent_dissociation", c.q2],
                ["practice_worsens_state", c.q3],
                ["has_human_support", c.q4],
                ["understands_can_stop", c.q5],
              ].map(([key, label]) => (
                <label key={key} className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer">
                  <Checkbox checked={answers[key]} onCheckedChange={(v) => setAnswer(key, v)} className="mt-0.5" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className={`rounded-xl border p-4 text-sm ${result.result === "proceed" ? "bg-primary/5 border-primary/20" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex items-start gap-2">
                {result.result === "proceed" ? <ShieldCheck className="w-4 h-4 mt-0.5 text-primary" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700" />}
                <p>{resultText}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!result ? (
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {c.submit}
              </Button>
            ) : result?.result === "proceed" ? (
              <Button onClick={() => { setOpen(false); navigate("/edge-program"); }}>{c.openProgram}</Button>
            ) : result?.result === "caution" ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setOpen(false); navigate("/edge-program"); }}>{c.openProgram}</Button>
                <Button onClick={() => setOpen(false)}>{lang === "es" ? "Cerrar" : "Закрыть"}</Button>
              </div>
            ) : (
              <Button onClick={() => setOpen(false)}>{lang === "es" ? "Cerrar" : "Закрыть"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}