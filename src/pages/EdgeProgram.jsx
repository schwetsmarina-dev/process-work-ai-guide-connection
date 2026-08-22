import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Sparkles, HeartHandshake, Pause, RotateCcw, BedDouble, ShieldCheck, Volume2 } from "lucide-react";
import { normalizeLang } from "@/lib/i18n";

const COPY = {
  ru: {
    title: "Возвращение к себе",
    subtitle: "28 дней исследования своего процесса",
    day: "День",
    week: "Неделя",
    loading: "Загружаю программу…",
    noProgram: "Активной программы пока нет.",
    back: "На главную",
    paused: "Программа на паузе. Твоё место сохранено.",
    completed: "Программа завершена.",
    stopped: "Программа остановлена.",
    caution: "Перед продолжением глубокой части нужно снова пройти короткую проверку готовности на главной странице. Ресурсный день и день отдыха остаются доступны.",
    checkin: "Перед началом: насколько сейчас интенсивно твоё состояние?",
    standard: "Сегодняшний день",
    soft: "Мягкая версия",
    resource: "День ресурса",
    rest: "День отдыха",
    repeat: "Повторить предыдущий",
    generating: "Готовлю день…",
    journal: "Вопросы для дневника",
    reflectTitle: "После практики",
    reflectHint: "Запиши, что действительно произошло с тобой. Не нужно делать правильные выводы.",
    reflectionPlaceholder: "Что ты заметила? Что было важным, приятным, трудным или неожиданным?",
    afterIntensity: "Насколько интенсивно состояние сейчас?",
    overwhelmed: "Мне стало слишком много / я была перегружена",
    dissociated: "Я чувствовала отключение, нереальность или потерю контакта с происходящим",
    analyze: "Сохранить и посмотреть наблюдения",
    analyzing: "Разбираю рефлексию…",
    reviewTitle: "Проверь, правильно ли Talvira тебя поняла",
    reviewHint: "Ничего из этого не станет частью карты процесса без твоего подтверждения.",
    confirm: "Да, подходит",
    correct: "Исправить",
    reject: "Нет, не моё",
    resourceTitle: "Что добавить в твою библиотеку поддержки?",
    helpful: "Помогает",
    neutral: "Нейтрально",
    notHelpful: "Не помогает",
    avoid: "Больше не предлагать",
    continue: "Перейти дальше",
    chooseRepeat: "Повторить",
    chooseResource: "Взять день ресурса",
    choosePause: "Пауза",
    pauseNow: "Поставить программу на паузу",
    resumeNow: "Продолжить программу",
    chooseStop: "Остановить программу",
    finalizing: "Сохраняю…",
    restDone: "На сегодня достаточно",
    supportReturn: "Вернуться к текущему дню",
    error: "Что-то не сработало. Попробуй ещё раз.",
    basedOn: "Методическая основа",
    createAudio: "Озвучить практику",
    audioGenerating: "Готовлю аудио…",
    audioFailed: "Не удалось создать аудио. Текст практики остаётся доступен.",
    restCount: "Дней отдыха",
    resourceCount: "Ресурсных дней",
  },
  es: {
    title: "Volver a mí",
    subtitle: "28 días para explorar tu proceso",
    day: "Día",
    week: "Semana",
    loading: "Cargando el programa…",
    noProgram: "Todavía no hay un programa activo.",
    back: "Volver al inicio",
    paused: "El programa está en pausa. Tu lugar está guardado.",
    completed: "Programa completado.",
    stopped: "Programa detenido.",
    caution: "Antes de continuar con la parte profunda, vuelve a hacer la breve comprobación de preparación en la página principal. El día de recursos y el día de descanso siguen disponibles.",
    checkin: "Antes de empezar: ¿qué intensidad tiene ahora tu estado?",
    standard: "Día de hoy",
    soft: "Versión suave",
    resource: "Día de recursos",
    rest: "Día de descanso",
    repeat: "Repetir el anterior",
    generating: "Preparando el día…",
    journal: "Preguntas para el diario",
    reflectTitle: "Después de la práctica",
    reflectHint: "Escribe lo que realmente ocurrió. No necesitas llegar a ninguna conclusión correcta.",
    reflectionPlaceholder: "¿Qué notaste? ¿Qué fue importante, agradable, difícil o inesperado?",
    afterIntensity: "¿Qué intensidad tiene ahora tu estado?",
    overwhelmed: "Fue demasiado para mí / me sentí sobrepasada",
    dissociated: "Sentí desconexión, irrealidad o pérdida de contacto con lo que ocurría",
    analyze: "Guardar y revisar observaciones",
    analyzing: "Revisando tu reflexión…",
    reviewTitle: "Comprueba si Talvira te entendió bien",
    reviewHint: "Nada se añadirá a tu mapa de proceso sin tu confirmación.",
    confirm: "Sí, encaja",
    correct: "Corregir",
    reject: "No es mío",
    resourceTitle: "¿Qué añadimos a tu biblioteca de apoyo?",
    helpful: "Me ayuda",
    neutral: "Neutral",
    notHelpful: "No me ayuda",
    avoid: "No volver a ofrecer",
    continue: "Continuar",
    chooseRepeat: "Repetir",
    chooseResource: "Tomar un día de recursos",
    choosePause: "Pausa",
    pauseNow: "Pausar programa",
    resumeNow: "Continuar programa",
    chooseStop: "Detener el programa",
    finalizing: "Guardando…",
    restDone: "Por hoy es suficiente",
    supportReturn: "Volver al día actual",
    error: "Algo no funcionó. Inténtalo de nuevo.",
    basedOn: "Base metodológica",
    createAudio: "Escuchar la práctica",
    audioGenerating: "Preparando el audio…",
    audioFailed: "No se pudo crear el audio. El texto de la práctica sigue disponible.",
    restCount: "Días de descanso",
    resourceCount: "Días de recursos",
  },
};

function RangeField({ value, onChange, label }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-sm font-semibold">{value}/10</span>
      </div>
      <input type="range" min="0" max="10" step="1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

export default function EdgeProgram() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generated, setGenerated] = useState(null);
  const [generationMode, setGenerationMode] = useState("standard");
  const [distressBefore, setDistressBefore] = useState(3);
  const [distressAfter, setDistressAfter] = useState(3);
  const [reflection, setReflection] = useState("");
  const [overwhelmed, setOverwhelmed] = useState(false);
  const [dissociated, setDissociated] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [observationReview, setObservationReview] = useState({});
  const [resourceReview, setResourceReview] = useState({});
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");

  const { data: authUser = null } = useQuery({ queryKey: ["edge-program-user"], queryFn: () => base44.auth.me() });
  const { data: appUsers = [] } = useQuery({
    queryKey: ["edge-program-app-user", authUser?.email],
    queryFn: () => base44.entities.AppUser.filter({ email: authUser.email }),
    enabled: !!authUser?.email,
  });
  const lang = normalizeLang(appUsers[0]?.language);
  const c = COPY[lang] || COPY.es;

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["edge-programs", authUser?.id],
    queryFn: () => base44.entities.EdgeProgram.filter({ user_id: authUser.id }, "-started_at", 20),
    enabled: !!authUser?.id,
    staleTime: 20_000,
  });
  const program = useMemo(() => {
    const byStatus = (status) => programs.find((p) => p.status === status);
    return byStatus("active") || byStatus("paused") || byStatus("completed") || byStatus("stopped") || programs[0] || null;
  }, [programs]);

  const { data: pendingDays = [] } = useQuery({
    queryKey: ["edge-program-pending-days", program?.id],
    queryFn: () => base44.entities.EdgeProgramDay.filter({ user_id: authUser.id, program_id: program.id, completed: false }, "-updated_date", 10),
    enabled: !!authUser?.id && !!program?.id,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (generated || !pendingDays.length) return;
    const row = pendingDays[0];
    const fallbackContent = {
      title: row.title || `${c.day} ${row.day_number}`,
      intro: "",
      steps: row.practice_text ? [{ title: "", text: row.practice_text }] : [],
      journal_questions: Array.isArray(row.journal_questions) ? row.journal_questions : [],
      closing: "",
      support_options: [],
      confirmation_prompt: "",
    };
    setGenerationMode(row.generation_mode || "standard");
    setDistressBefore(Number.isFinite(Number(row.distress_before)) ? Number(row.distress_before) : 3);
    setDistressAfter(Number.isFinite(Number(row.distress_after)) ? Number(row.distress_after) : 3);
    setReflection(row.reflection || "");
    setOverwhelmed(row.felt_overwhelmed === true);
    setDissociated(row.felt_dissociated === true);
    setGenerated({
      mode: row.generation_mode || "standard",
      day_number: row.day_number,
      week_number: row.week_number,
      content: row.generated_content || fallbackContent,
      used_exercise_ids: Array.isArray(row.exercise_ids) ? row.exercise_ids : [],
      day_record: row,
    });
    setAudioUrl(row.audio_status === "ready" ? (row.audio_url || "") : "");
    setAudioError(row.audio_status === "failed" ? (row.audio_error || "audio_failed") : "");
    if (row.completion_phase === "awaiting_review") {
      const observations = Array.isArray(row.ai_observations) ? row.ai_observations : [];
      const resources = Array.isArray(row.resource_updates) ? row.resource_updates : [];
      setAnalysis({
        phase: "awaiting_review",
        reflection_summary: row.reflection_summary || "",
        observations,
        resource_candidates: resources,
      });
      const obs = {}; observations.forEach((x) => { obs[x.id] = { decision: "", corrected_value: x.value }; });
      const res = {}; resources.forEach((x) => { res[x.id] = { decision: "", corrected_label: x.label, effect: x.proposed_effect || "helpful" }; });
      setObservationReview(obs);
      setResourceReview(res);
    }
  }, [pendingDays, generated, c.day]);

  const usedExerciseIds = Array.isArray(generated?.used_exercise_ids) ? generated.used_exercise_ids.filter(Boolean) : [];
  const { data: usedExercises = [] } = useQuery({
    queryKey: ["edge-program-used-exercises", generated?.day_record?.id || generated?.day_number, usedExerciseIds.join("|")],
    queryFn: () => base44.entities.ProcessExercise.filter({ exercise_id: { $in: usedExerciseIds } }, "exercise_id", 10),
    enabled: usedExerciseIds.length > 0,
    staleTime: 10 * 60_000,
  });

  const updateProgramState = async (action) => {
    if (!program?.id) return;
    setWorking(`state-${action}`); setError("");
    try {
      await base44.functions.invoke("updateEdgeProgramState", { program_id: program.id, action });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["edge-programs", authUser?.id] }),
        queryClient.invalidateQueries({ queryKey: ["edge-program-readiness"] }),
      ]);
      if (action === "stop") resetDayState();
    } catch (e) {
      console.error("[EdgeProgram] state update failed", e?.message); setError(c.error);
    } finally { setWorking(""); }
  };

  const resetDayState = () => {
    setGenerated(null); setAnalysis(null); setReflection(""); setOverwhelmed(false); setDissociated(false);
    setObservationReview({}); setResourceReview({}); setError(""); setAudioUrl(""); setAudioError("");
  };

  const generate = async (mode) => {
    if (!program?.id) return;
    setWorking("generate"); setError(""); setGenerationMode(mode); setAnalysis(null);
    try {
      const res = await base44.functions.invoke("generateEdgeProgramDay", {
        program_id: program.id,
        mode,
        distress_before: distressBefore,
      });
      setGenerated(res?.data || null);
      setAudioUrl(res?.data?.day_record?.audio_status === "ready" ? (res.data.day_record.audio_url || "") : "");
      setAudioError("");
      setReflection(""); setOverwhelmed(false); setDissociated(false); setObservationReview({}); setResourceReview({});
    } catch (e) {
      console.error("[EdgeProgram] generate failed", e?.message);
      setError(c.error);
    } finally { setWorking(""); }
  };

  const practiceTextForAudio = () => {
    const content = generated?.content;
    if (!content) return "";
    return [content.intro, ...(content.steps || []).map((s) => `${s.title ? `${s.title}. ` : ""}${s.text || ""}`), content.closing].filter(Boolean).join("\n\n");
  };

  const generateAudio = async () => {
    if (!program?.id || !generated?.content) return;
    setWorking("audio"); setAudioError("");
    try {
      const payload = generated?.day_record?.id
        ? { day_id: generated.day_record.id }
        : { program_id: program.id, practice_text: practiceTextForAudio(), support_event_id: generated?.support_event_id || "" };
      const res = await base44.functions.invoke("generateEdgeProgramDayAudio", payload);
      if (res?.data?.ok && res.data.audio_url) {
        setAudioUrl(res.data.audio_url);
        if (generated?.day_record?.id) await queryClient.invalidateQueries({ queryKey: ["edge-program-pending-days", program.id] });
      } else setAudioError(res?.data?.reason || "audio_failed");
    } catch (e) {
      console.error("[EdgeProgram] audio failed", e?.message); setAudioError(e?.message || "audio_failed");
    } finally { setWorking(""); }
  };

  const finishSupportDay = async () => {
    if (!program?.id || !generated?.support_event_id || !supportOnly) { resetDayState(); return; }
    setWorking("support-day"); setError("");
    try {
      await base44.functions.invoke("recordEdgeProgramSupportDay", {
        program_id: program.id,
        event_id: generated.support_event_id,
        kind: generationMode,
      });
      await queryClient.invalidateQueries({ queryKey: ["edge-programs", authUser?.id] });
      resetDayState();
    } catch (e) {
      console.error("[EdgeProgram] support day record failed", e?.message); setError(c.error);
    } finally { setWorking(""); }
  };

  const analyze = async () => {
    const dayId = generated?.day_record?.id;
    if (!program?.id || !dayId) return;
    setWorking("analyze"); setError("");
    try {
      const res = await base44.functions.invoke("completeEdgeProgramDay", {
        phase: "analyze", program_id: program.id, day_id: dayId, reflection,
        distress_after: distressAfter, felt_overwhelmed: overwhelmed, felt_dissociated: dissociated,
      });
      const data = res?.data || null;
      setAnalysis(data);
      const obs = {}; (data?.observations || []).forEach((x) => { obs[x.id] = { decision: "", corrected_value: x.value }; });
      const resources = {}; (data?.resource_candidates || []).forEach((x) => { resources[x.id] = { decision: "", corrected_label: x.label, effect: x.proposed_effect || "helpful" }; });
      setObservationReview(obs); setResourceReview(resources);
    } catch (e) {
      console.error("[EdgeProgram] analyze failed", e?.message); setError(c.error);
    } finally { setWorking(""); }
  };

  const reviewsComplete = useMemo(() => {
    if (!analysis) return false;
    const obsOk = (analysis.observations || []).every((x) => observationReview[x.id]?.decision);
    const resOk = (analysis.resource_candidates || []).every((x) => resourceReview[x.id]?.decision);
    return obsOk && resOk;
  }, [analysis, observationReview, resourceReview]);

  const finalize = async (progressionChoice = "") => {
    const dayId = generated?.day_record?.id;
    if (!program?.id || !dayId || !analysis || !reviewsComplete) return;
    setWorking("finalize"); setError("");
    try {
      const res = await base44.functions.invoke("completeEdgeProgramDay", {
        phase: "finalize", program_id: program.id, day_id: dayId,
        observation_review: Object.entries(observationReview).map(([id, x]) => ({ id, ...x })),
        resource_review: Object.entries(resourceReview).map(([id, x]) => ({ id, ...x })),
        progression_choice: progressionChoice,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["edge-programs", authUser?.id] }),
        queryClient.invalidateQueries({ queryKey: ["edge-program-pending-days", program.id] }),
      ]);
      resetDayState();
      const decision = res?.data?.progression_decision;
      if (decision === "resource") setTimeout(() => generate("resource_day"), 50);
      else if (decision === "repeat") setTimeout(() => generate("repeat_previous"), 50);
    } catch (e) {
      console.error("[EdgeProgram] finalize failed", e?.message); setError(c.error);
    } finally { setWorking(""); }
  };

  if (isLoading) return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-muted-foreground">{c.loading}</div>;
  if (!program) return <div className="max-w-3xl mx-auto px-4 py-12"><p className="text-muted-foreground mb-4">{c.noProgram}</p><Button onClick={() => navigate("/dashboard")}>{c.back}</Button></div>;

  const cautionPaused = program.status === "paused" && program.safety_state === "caution";
  const deepModesDisabled = cautionPaused || ["completed", "stopped"].includes(program.status);
  const content = generated?.content;
  const supportOnly = ["rest_day", "resource_day"].includes(generationMode) && !generated?.day_record;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}><ArrowLeft className="w-4 h-4 mr-2" />{c.back}</Button>
      <div>
        <p className="text-xs uppercase tracking-wide text-primary mb-1">{c.day} {program.current_day || 1} · {c.week} {program.current_week || 1}</p>
        <h1 className="font-serif text-3xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground mt-1">{c.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-2">{c.resourceCount}: {Number(program.resource_days_taken || 0)} · {c.restCount}: {Number(program.rest_days_taken || 0)}</p>
      </div>

      {program.status === "paused" && <Card className="p-4 border-amber-200 bg-amber-50"><p className="text-sm">{c.paused}</p>{cautionPaused && <p className="text-sm text-amber-800 mt-2">{c.caution}</p>}{!cautionPaused && <Button size="sm" className="mt-3" onClick={() => updateProgramState("resume")} disabled={working}>{c.resumeNow}</Button>}</Card>}
      {program.status === "completed" && <Card className="p-4"><p>{c.completed}</p></Card>}
      {program.status === "stopped" && <Card className="p-4"><p>{c.stopped}</p></Card>}

      {!content && !["completed", "stopped"].includes(program.status) && (
        <Card className="p-5 space-y-5">
          <RangeField value={distressBefore} onChange={setDistressBefore} label={c.checkin} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generate("standard")} disabled={working || deepModesDisabled || program.status === "paused"}><Sparkles className="w-4 h-4 mr-2" />{c.standard}</Button>
            <Button variant="outline" onClick={() => generate("soft_version")} disabled={working || deepModesDisabled || program.status === "paused"}>{c.soft}</Button>
            <Button variant="outline" onClick={() => generate("resource_day")} disabled={working}><HeartHandshake className="w-4 h-4 mr-2" />{c.resource}</Button>
            <Button variant="outline" onClick={() => generate("rest_day")} disabled={working}><BedDouble className="w-4 h-4 mr-2" />{c.rest}</Button>
            {Number(program.current_day || 1) > 1 && <Button variant="ghost" onClick={() => generate("repeat_previous")} disabled={working || deepModesDisabled || program.status === "paused"}><RotateCcw className="w-4 h-4 mr-2" />{c.repeat}</Button>}
            {program.status === "active" && <Button variant="ghost" onClick={() => updateProgramState("pause")} disabled={working}><Pause className="w-4 h-4 mr-2" />{c.pauseNow}</Button>}
          </div>
          {working === "generate" && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{c.generating}</p>}
        </Card>
      )}

      {content && (
        <Card className="p-5 md:p-6 space-y-5">
          <div><p className="text-xs uppercase tracking-wide text-primary">{c.day} {generated.day_number}</p><h2 className="font-serif text-2xl font-semibold mt-1">{content.title}</h2></div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content.intro}</p>
          {usedExercises.length > 0 && <p className="text-xs text-muted-foreground">{c.basedOn}: {usedExercises.map((x) => x.author || (lang === "es" ? x.title_es : x.title_ru)).filter(Boolean).join(" · ")}</p>}
          <div className="space-y-4">{(content.steps || []).map((s, i) => <div key={i}><p className="font-medium text-sm mb-1">{s.title}</p><p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{s.text}</p></div>)}</div>
          {(content.journal_questions || []).length > 0 && <div className="border-t pt-4"><p className="font-medium text-sm mb-2">{c.journal}</p><ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">{content.journal_questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
          <p className="text-sm leading-relaxed border-t pt-4">{content.closing}</p>
          <div className="space-y-2">
            {audioUrl ? <audio controls preload="none" className="w-full" src={audioUrl} /> : <Button variant="outline" size="sm" onClick={generateAudio} disabled={working}><Volume2 className="w-4 h-4 mr-2" />{working === "audio" ? c.audioGenerating : c.createAudio}</Button>}
            {audioError && <p className="text-xs text-red-700">{c.audioFailed}</p>}
          </div>
          {program.status === "active" && <Button variant="ghost" size="sm" onClick={() => updateProgramState("pause")} disabled={working}><Pause className="w-4 h-4 mr-2" />{c.pauseNow}</Button>}
          {supportOnly && <Button variant="outline" onClick={finishSupportDay} disabled={working}>{generationMode === "rest_day" ? c.restDone : c.supportReturn}</Button>}
        </Card>
      )}

      {content && generated?.day_record && !analysis && (
        <Card className="p-5 md:p-6 space-y-4">
          <div><h3 className="font-serif text-xl font-semibold">{c.reflectTitle}</h3><p className="text-sm text-muted-foreground mt-1">{c.reflectHint}</p></div>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder={c.reflectionPlaceholder} className="w-full min-h-32 rounded-xl border border-border bg-background p-3 text-sm" />
          <RangeField value={distressAfter} onChange={setDistressAfter} label={c.afterIntensity} />
          <label className="flex gap-3 text-sm"><Checkbox checked={overwhelmed} onCheckedChange={(v) => setOverwhelmed(v === true)} /><span>{c.overwhelmed}</span></label>
          <label className="flex gap-3 text-sm"><Checkbox checked={dissociated} onCheckedChange={(v) => setDissociated(v === true)} /><span>{c.dissociated}</span></label>
          <Button onClick={analyze} disabled={working || (!reflection.trim() && generationMode !== "rest_day")}>
            {working === "analyze" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{working === "analyze" ? c.analyzing : c.analyze}
          </Button>
        </Card>
      )}

      {analysis && (
        <Card className="p-5 md:p-6 space-y-5">
          <div><h3 className="font-serif text-xl font-semibold">{c.reviewTitle}</h3><p className="text-sm text-muted-foreground mt-1">{c.reviewHint}</p></div>
          {analysis.reflection_summary && <p className="text-sm p-3 rounded-xl bg-muted/40">{analysis.reflection_summary}</p>}
          {(analysis.observations || []).map((o) => {
            const state = observationReview[o.id] || {};
            return <div key={o.id} className="rounded-xl border p-4 space-y-2"><p className="text-sm">{o.value}</p>{o.evidence && <p className="text-xs text-muted-foreground">{o.evidence}</p>}<select value={state.decision || ""} onChange={(e) => setObservationReview((p) => ({ ...p, [o.id]: { ...state, decision: e.target.value } }))} className="h-9 rounded-lg border bg-background px-2 text-sm"><option value="">—</option><option value="confirm">{c.confirm}</option><option value="correct">{c.correct}</option><option value="reject">{c.reject}</option></select>{state.decision === "correct" && <input value={state.corrected_value || ""} onChange={(e) => setObservationReview((p) => ({ ...p, [o.id]: { ...state, corrected_value: e.target.value } }))} className="w-full h-10 rounded-lg border bg-background px-3 text-sm" />}</div>;
          })}
          {(analysis.resource_candidates || []).length > 0 && <div className="space-y-3"><p className="font-medium text-sm">{c.resourceTitle}</p>{analysis.resource_candidates.map((r) => { const state = resourceReview[r.id] || {}; return <div key={r.id} className="rounded-xl border p-4 space-y-2"><input value={state.corrected_label || r.label} onChange={(e) => setResourceReview((p) => ({ ...p, [r.id]: { ...state, corrected_label: e.target.value, decision: state.decision || "correct" } }))} className="w-full h-10 rounded-lg border bg-background px-3 text-sm" /><div className="flex flex-wrap gap-2"><select value={state.decision || ""} onChange={(e) => setResourceReview((p) => ({ ...p, [r.id]: { ...state, decision: e.target.value } }))} className="h-9 rounded-lg border bg-background px-2 text-sm"><option value="">—</option><option value="confirm">{c.confirm}</option><option value="correct">{c.correct}</option><option value="reject">{c.reject}</option></select>{state.decision !== "reject" && <select value={state.effect || "helpful"} onChange={(e) => setResourceReview((p) => ({ ...p, [r.id]: { ...state, effect: e.target.value } }))} className="h-9 rounded-lg border bg-background px-2 text-sm"><option value="helpful">{c.helpful}</option><option value="neutral">{c.neutral}</option><option value="not_helpful">{c.notHelpful}</option><option value="avoid">{c.avoid}</option></select>}</div></div>; })}</div>}
          {reviewsComplete && <div className="flex flex-wrap gap-2 border-t pt-4"><Button onClick={() => finalize("")} disabled={working}><ShieldCheck className="w-4 h-4 mr-2" />{c.continue}</Button><Button variant="outline" onClick={() => finalize("repeat")} disabled={working}>{c.chooseRepeat}</Button><Button variant="outline" onClick={() => finalize("resource")} disabled={working}>{c.chooseResource}</Button><Button variant="outline" onClick={() => finalize("pause")} disabled={working}><Pause className="w-4 h-4 mr-2" />{c.choosePause}</Button><Button variant="ghost" onClick={() => finalize("stop")} disabled={working}>{c.chooseStop}</Button></div>}
          {working === "finalize" && <p className="text-sm text-muted-foreground flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" />{c.finalizing}</p>}
        </Card>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
