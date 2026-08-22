import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search, ShieldCheck, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeLang } from "@/lib/i18n";
import useEntitlement from "@/hooks/useEntitlement";
import { FEATURES } from "@/lib/entitlement";

function hasNamedAuthor(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  const genericOnly = /^(process work учебная практика|ispwr training materials|ispwr\s*\/\s*сертификационные материалы|ispwr\s*\/\s*talvira adaptation|talvira methodology synthesis|ispwr trauma\/resource materials\s*\/\s*talvira adaptation)$/i;
  return !genericOnly.test(s);
}

const COPY = {
  ru: {
    title: "Библиотека практик",
    subtitle: "Готовые процессуальные упражнения с указанным автором или учебным источником. Здесь нет техник, которые требуют живого специалиста или относятся к высокой интенсивности.",
    search: "Найти по теме, автору или названию…",
    author: "Автор",
    source: "Источник",
    purpose: "Для чего",
    steps: "Как пройти практику",
    open: "Открыть",
    close: "Свернуть",
    conditional: "Используй только если тема сейчас переносима; при перегрузке остановись и выбери более мягкую практику.",
    conditions: "Подходит, если",
    avoidIf: "Не выбирать, если",
    empty: "По этому запросу практик не найдено.",
    locked: "Библиотека практик доступна в полной версии Talvira.",
  },
  es: {
    title: "Biblioteca de prácticas",
    subtitle: "Ejercicios procesuales preparados con autor o fuente formativa identificados. No se muestran técnicas de alta intensidad ni las que requieren un profesional en vivo.",
    search: "Buscar por tema, autor o título…",
    author: "Autor",
    source: "Fuente",
    purpose: "Para qué sirve",
    steps: "Cómo hacer la práctica",
    open: "Abrir",
    close: "Cerrar",
    conditional: "Úsala solo si el tema es tolerable ahora; si te sobrecarga, detente y elige una práctica más suave.",
    conditions: "Adecuada si",
    avoidIf: "No elegir si",
    empty: "No hay prácticas para esta búsqueda.",
    locked: "La biblioteca de prácticas está disponible en la versión completa de Talvira.",
  },
  en: {
    title: "Practice library",
    subtitle: "Ready-to-use process exercises with an identified author or training source. High-intensity and live-facilitator techniques are not shown here.",
    search: "Search by topic, author, or title…",
    author: "Author",
    source: "Source",
    purpose: "Purpose",
    steps: "How to do the practice",
    open: "Open",
    close: "Close",
    conditional: "Use only if the topic feels manageable now; if you become overloaded, stop and choose a gentler practice.",
    conditions: "Use when",
    avoidIf: "Do not choose when",
    empty: "No practices match this search.",
    locked: "The practice library is available with full Talvira access.",
  },
};

export default function PracticeLibrary() {
  const queryClient = useQueryClient();
  const { can } = useEntitlement();
  const hasAccess = can(FEATURES.PRACTICE);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [localizing, setLocalizing] = useState(false);
  const [localizationAttempted, setLocalizationAttempted] = useState(false);

  const { data: me = null } = useQuery({ queryKey: ["practice-library-user"], queryFn: () => base44.auth.me() });
  const { data: appUsers = [] } = useQuery({
    queryKey: ["practice-library-app-user", me?.email],
    queryFn: () => base44.entities.AppUser.filter({ email: me.email }),
    enabled: !!me?.email,
  });
  const lang = normalizeLang(appUsers[0]?.language);
  const c = COPY[lang] || COPY.es;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["authored-practice-library"],
    queryFn: () => base44.entities.ProcessExercise.filter({ active: true }, "exercise_id", 500),
    enabled: hasAccess === true,
    staleTime: 10 * 60_000,
  });

  const visibleRows = useMemo(() => rows
    .filter((x) => hasNamedAuthor(x.author))
    .filter((x) => x.requires_live_facilitator !== true && ["ai_self_guided", "conditional"].includes(x.delivery_level) && x.intensity !== "high"), [rows]);

  const spanishMissing = useMemo(() => visibleRows.filter((x) => !String(x.title_es || "").trim() || !String(x.purpose_es || "").trim() || !Array.isArray(x.steps_es) || x.steps_es.length !== (x.steps || []).length), [visibleRows]);

  useEffect(() => {
    if (lang !== "es" || hasAccess !== true || isLoading || localizing || localizationAttempted || spanishMissing.length === 0) return;
    setLocalizationAttempted(true);
    setLocalizing(true);
    base44.functions.invoke("localizeProcessExerciseLibrary", {})
      .then(() => queryClient.invalidateQueries({ queryKey: ["authored-practice-library"] }))
      .catch((e) => console.warn("[PracticeLibrary] Spanish localization failed:", e?.message))
      .finally(() => setLocalizing(false));
  }, [lang, hasAccess, isLoading, localizing, localizationAttempted, spanishMissing.length, queryClient]);

  const practices = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const localizedRows = lang === "es"
      ? visibleRows.filter((x) => String(x.title_es || "").trim() && String(x.purpose_es || "").trim() && Array.isArray(x.steps_es) && x.steps_es.length === (x.steps || []).length)
      : visibleRows;
    return localizedRows.filter((x) => {
      if (!q) return true;
      const haystack = [x.title_ru, x.title_es, x.author, x.source, x.purpose, x.purpose_es, ...(x.steps_es || []), ...(x.search_tags || []), ...(x.term_keys || [])].join(" ").toLocaleLowerCase();
      return haystack.includes(q);
    });
  }, [visibleRows, query, lang]);

  if (hasAccess === false) {
    return <div className="max-w-4xl mx-auto px-4 py-10"><Card className="p-6"><p className="text-sm text-muted-foreground">{c.locked}</p></Card></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2"><BookOpen className="w-5 h-5" /><span className="text-xs uppercase tracking-wide font-medium">Talvira</span></div>
        <h1 className="font-serif text-3xl font-semibold">{c.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{c.subtitle}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-3 text-sm" />
      </div>

      {(isLoading || (lang === "es" && localizing)) ? <p className="text-sm text-muted-foreground">…</p> : practices.length === 0 ? <p className="text-sm text-muted-foreground">{c.empty}</p> : (
        <div className="space-y-3">
          {practices.map((exercise) => {
            const expanded = openId === exercise.id;
            return (
              <Card key={exercise.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl font-semibold">{lang === "es" ? exercise.title_es : exercise.title_ru}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5" />{c.author}: {exercise.author}</span>
                      {exercise.source && <span>{c.source}: {exercise.source}</span>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setOpenId(expanded ? "" : exercise.id)}>{expanded ? c.close : c.open}</Button>
                </div>

                {expanded && (
                  <div className="mt-5 space-y-4 border-t pt-4">
                    {(lang === "es" ? exercise.purpose_es : exercise.purpose) && <div><p className="text-sm font-medium mb-1">{c.purpose}</p><p className="text-sm text-muted-foreground leading-relaxed">{lang === "es" ? exercise.purpose_es : exercise.purpose}</p></div>}
                    {exercise.delivery_level === "conditional" && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 space-y-2"><div className="flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" /><span>{c.conditional}</span></div>{lang !== "es" && (exercise.delivery_conditions || []).length > 0 && <p><strong>{c.conditions}:</strong> {exercise.delivery_conditions.join(" · ")}</p>}{lang !== "es" && [...(exercise.exclude_if || []), ...(exercise.contraindications || [])].length > 0 && <p><strong>{c.avoidIf}:</strong> {[...(exercise.exclude_if || []), ...(exercise.contraindications || [])].join(" · ")}</p>}</div>}
                    <div><p className="text-sm font-medium mb-2">{c.steps}</p><ol className="space-y-2 list-decimal pl-5 text-sm leading-relaxed">{(lang === "es" ? exercise.steps_es : (exercise.steps || [])).map((step, i) => <li key={i}>{step}</li>)}</ol></div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}