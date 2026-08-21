import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Sparkles, Volume2 } from "lucide-react";

const COPY = {
  ru: {
    eyebrow: "Персональная процессуальная практика",
    title: "Похоже, одна тема возвращается снова",
    body: "В нескольких последних сессиях проявляется повторяющаяся динамика. Talvira может собрать из уже исследованного материала персональную процессуальную практику — без интерпретаций за вас и без задачи «починить» или изменить вас.",
    generate: "Создать практику",
    generating: "Собираю практику…",
    audioGenerating: "Готовлю аудио…",
    ready: "Ваша персональная практика",
    textAvailable: "Текст уже готов. Аудио можно создать отдельно.",
    createAudio: "Создать аудио",
    audioFailed: "Не удалось создать аудио. Текст практики сохранён и доступен.",
    retryAudio: "Повторить аудио",
    refresh: "Создать новую практику по последним сессиям",
    error: "Не удалось подготовить практику. Попробуйте позже.",
    basedOn: "Методическая основа",
    facilitator: "Дополнительная поддержка",
  },
  es: {
    eyebrow: "Práctica procesual personal",
    title: "Parece que un mismo tema está volviendo",
    body: "En varias sesiones recientes aparece una dinámica recurrente. Talvira puede reunir lo ya explorado en una práctica procesual personal, sin interpretar por ti ni intentar cambiarte o «arreglarte».",
    generate: "Crear práctica",
    generating: "Preparando la práctica…",
    audioGenerating: "Preparando el audio…",
    ready: "Tu práctica personal",
    textAvailable: "El texto ya está listo. Puedes generar el audio aparte.",
    createAudio: "Crear audio",
    audioFailed: "No se pudo crear el audio. El texto de la práctica está guardado y disponible.",
    retryAudio: "Reintentar audio",
    refresh: "Crear una práctica nueva con las últimas sesiones",
    error: "No se pudo preparar la práctica. Inténtalo más tarde.",
    basedOn: "Base metodológica",
    facilitator: "Apoyo adicional",
  },
  en: {
    eyebrow: "Personal process practice",
    title: "A recurring theme seems to be emerging",
    body: "A similar dynamic has appeared across several recent sessions. Talvira can turn the material you have already explored into a personal process practice, without interpreting you or trying to fix or change you.",
    generate: "Create practice",
    generating: "Building your practice…",
    audioGenerating: "Preparing audio…",
    ready: "Your personal practice",
    textAvailable: "The text is ready. Audio can be generated separately.",
    createAudio: "Create audio",
    audioFailed: "Audio could not be generated. The practice text is saved and available.",
    retryAudio: "Retry audio",
    refresh: "Create a new practice from recent sessions",
    error: "The practice could not be prepared. Please try again later.",
    basedOn: "Method basis",
    facilitator: "Additional support",
  },
};

function copyFor(lang) {
  return COPY[lang] || COPY.ru;
}

export default function PersonalProcessPracticeCard({ userId, lang = "ru", completedSessions = [] }) {
  const queryClient = useQueryClient();
  const c = copyFor(lang);
  const [working, setWorking] = useState(false);
  const [audioWorking, setAudioWorking] = useState(false);
  const [error, setError] = useState("");

  const { data: practices = [], isLoading: practicesLoading } = useQuery({
    queryKey: ["process-practices", userId],
    queryFn: () => base44.entities.ProcessPractice.filter(
      { user_id: userId, is_test: false },
      "-generated_at",
      20,
    ),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const latestPractice = practices[0] || null;
  const practiceExerciseIds = Array.isArray(latestPractice?.exercise_ids) ? latestPractice.exercise_ids.filter(Boolean) : [];
  const { data: sourceExercises = [] } = useQuery({
    queryKey: ["process-practice-exercises", latestPractice?.id, practiceExerciseIds.join("|")],
    queryFn: () => base44.entities.ProcessExercise.filter({ exercise_id: { $in: practiceExerciseIds } }, "exercise_id", 10),
    enabled: practiceExerciseIds.length > 0,
    staleTime: 10 * 60_000,
  });
  const latestCompletedSessionId = completedSessions[0]?.id || null;
  const latestPracticeCoversNewestSession = useMemo(() => {
    if (!latestPractice || !latestCompletedSessionId) return false;
    return Array.isArray(latestPractice.source_session_ids)
      && latestPractice.source_session_ids.includes(latestCompletedSessionId);
  }, [latestPractice, latestCompletedSessionId]);

  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["process-practice-readiness", userId, latestCompletedSessionId],
    queryFn: async () => {
      const res = await base44.functions.invoke("checkProcessPracticeReadiness", {});
      return res.data || {};
    },
    enabled: !!userId && completedSessions.length >= 3 && !latestPracticeCoversNewestSession,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const generateAudio = async (practice) => {
    if (!practice?.id) return practice;
    setAudioWorking(true);
    try {
      const audioRes = await base44.functions.invoke("generatePracticeAudio", { practice_id: practice.id });
      const merged = {
        ...practice,
        audio_status: audioRes.data?.ok ? "ready" : "failed",
        audio_url: audioRes.data?.audio_url || practice.audio_url,
        audio_error: audioRes.data?.error || audioRes.data?.reason || practice.audio_error,
      };
      await queryClient.invalidateQueries({ queryKey: ["process-practices", userId] });
      return merged;
    } catch (e) {
      console.warn("[PersonalProcessPracticeCard] audio generation failed:", e?.message);
      await queryClient.invalidateQueries({ queryKey: ["process-practices", userId] });
      return { ...practice, audio_status: "failed", audio_error: e?.message || "audio_failed" };
    } finally {
      setAudioWorking(false);
    }
  };

  const handleGenerate = async () => {
    setWorking(true);
    setError("");
    try {
      const res = await base44.functions.invoke("generateProcessPractice", {});
      if (res.data?.ready === false) {
        await queryClient.invalidateQueries({ queryKey: ["process-practice-readiness", userId] });
        return;
      }
      const practice = res.data?.practice;
      await queryClient.invalidateQueries({ queryKey: ["process-practices", userId] });
      if (practice?.id) await generateAudio(practice);
    } catch (e) {
      console.error("[PersonalProcessPracticeCard] practice generation failed:", e?.message);
      setError(c.error);
    } finally {
      setWorking(false);
    }
  };

  const visiblePractice = latestPractice;

  if (practicesLoading) return null;

  if (visiblePractice) {
    return (
      <Card className="p-5 md:p-6 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <Volume2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">{c.eyebrow}</p>
            <h3 className="font-serif text-xl font-semibold mb-1">{visiblePractice.theme_label || c.ready}</h3>
            {visiblePractice.offer_text && (
              <p className="text-sm text-muted-foreground mb-4">{visiblePractice.offer_text}</p>
            )}
            {sourceExercises.length > 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                {c.basedOn}: {sourceExercises.map((x) => x.author || x.title_ru).filter(Boolean).join(" · ")}
              </p>
            )}
            {visiblePractice.suggest_live_facilitator && visiblePractice.live_facilitator_note && (
              <div className="rounded-xl border border-primary/15 bg-background/60 p-3 mb-4">
                <p className="text-xs font-medium mb-1">{c.facilitator}</p>
                <p className="text-sm text-muted-foreground">{visiblePractice.live_facilitator_note}</p>
              </div>
            )}

            {visiblePractice.audio_status === "ready" && visiblePractice.audio_url ? (
              <audio controls preload="none" className="w-full" src={visiblePractice.audio_url} />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {visiblePractice.audio_status === "failed" ? c.audioFailed : c.textAvailable}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAudio(visiblePractice)}
                  disabled={audioWorking}
                >
                  {audioWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                  {audioWorking ? c.audioGenerating : (visiblePractice.audio_status === "failed" ? c.retryAudio : c.createAudio)}
                </Button>
              </div>
            )}

            {visiblePractice.full_text && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">{lang === "es" ? "Leer el texto" : lang === "en" ? "Read text" : "Прочитать текст"}</summary>
                <div className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/90">{visiblePractice.full_text}</div>
              </details>
            )}

            {!latestPracticeCoversNewestSession && readiness?.ready && (
              <Button className="mt-4" onClick={handleGenerate} disabled={working || audioWorking}>
                {working || audioWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {working ? c.generating : audioWorking ? c.audioGenerating : c.refresh}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (readinessLoading || !readiness?.ready) return null;

  return (
    <Card className="p-5 md:p-6 border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">{c.eyebrow}</p>
          <h3 className="font-serif text-xl font-semibold mb-2">{c.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{c.body}</p>
          {readiness.theme_label && (
            <p className="text-sm mb-4"><span className="font-medium">{readiness.theme_label}</span></p>
          )}
          <Button onClick={handleGenerate} disabled={working || audioWorking}>
            {working || audioWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {working ? c.generating : audioWorking ? c.audioGenerating : c.generate}
          </Button>
          {error && (
            <div className="flex items-start gap-2 mt-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
