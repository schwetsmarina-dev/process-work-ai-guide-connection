import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { t, getStoredLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Brain, Layers3, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { generateThemePatterns } from "@/lib/themePatternsAI";
import useEntitlement from "@/hooks/useEntitlement";
import { FEATURES } from "@/lib/entitlement";

const MODE_COLORS = {
  body: "hsl(160, 30%, 42%)",
  dream: "hsl(200, 25%, 50%)",
  conflict: "hsl(30, 40%, 55%)",
  journaling: "hsl(280, 20%, 55%)",
};

const MODE_NAME_KEYS = {
  body: "mode_body",
  dream: "mode_dream",
  conflict: "mode_conflict",
  journaling: "mode_journaling",
};

export default function Insights() {
  const lang = getStoredLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [generatingPattern, setGeneratingPattern] = useState("");
  const [generatedPractice, setGeneratedPractice] = useState(null);
  const [practiceError, setPracticeError] = useState("");
  const { can } = useEntitlement();
  const canUsePractice = can(FEATURES.PRACTICE);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions-all", currentUser?.email],
    // Ownership uses `user_id`, not created_by — both Session and UserMemory
    // are written server-side (startSession / persistSessionMemory), which
    // stamps created_by/created_by_id with the SERVICE ROLE's identity.
    queryFn: () => base44.entities.Session.filter({ user_id: currentUser.id }, "-created_date", 100),
    enabled: !!currentUser?.id,
  });

  const { data: memories = [], isLoading: memoriesLoading } = useQuery({
    queryKey: ["memories", currentUser?.email],
    queryFn: () => base44.entities.UserMemory.filter({ user_id: currentUser.id }, "-created_date", 50),
    enabled: !!currentUser?.id,
  });

  const isLoading = sessionsLoading || memoriesLoading;
  const completedSessions = sessions.filter((s) => s.status === "completed");

  const { data: themePatterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["theme-patterns", lang, completedSessions.map((s) => s.id).join(",")],
    queryFn: () => generateThemePatterns({ sessions: completedSessions, lang }),
    enabled: completedSessions.length >= 3,
    staleTime: Infinity,
  });

  const generatePracticeForPattern = async (pattern) => {
    if (!pattern?.session_ids?.length || canUsePractice !== true) return;
    const key = `${pattern.label}:${pattern.session_ids.join(",")}`;
    setGeneratingPattern(key);
    setPracticeError("");
    setGeneratedPractice(null);
    try {
      const res = await base44.functions.invoke("generateProcessPractice", {
        source_session_ids: pattern.session_ids,
        theme_label: pattern.label,
        theme_observation: pattern.observation,
      });
      if (res?.data?.ready === false) {
        setPracticeError(lang === "es" ? "Aún no hay suficiente material para crear una práctica segura con este tema." : "Пока недостаточно материала, чтобы безопасно собрать практику по этой теме.");
        return;
      }
      if (res?.data?.practice) setGeneratedPractice(res.data.practice);
    } catch (e) {
      console.error("[Insights] selected-theme practice generation failed:", e?.message);
      setPracticeError(lang === "es" ? "No se pudo crear la práctica. Inténtalo de nuevo más tarde." : "Не удалось создать практику. Попробуй ещё раз позже.");
    } finally {
      setGeneratingPattern("");
    }
  };

  // Mode distribution
  const modeDistribution = Object.entries(
    completedSessions.reduce((acc, s) => {
      acc[s.mode] = (acc[s.mode] || 0) + 1;
      return acc;
    }, {})
  ).map(([mode, count]) => ({
    name: MODE_NAME_KEYS[mode] ? t(MODE_NAME_KEYS[mode], lang) : mode,
    value: count,
    color: MODE_COLORS[mode] || "hsl(0, 0%, 50%)",
  }));

  // Theme frequency
  const allThemes = completedSessions.flatMap((s) => s.themes || []);
  const themeFrequency = Object.entries(
    allThemes.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Memory categories
  const memoryCategories = Object.entries(
    memories.reduce((acc, m) => {
      acc[m.category || "other"] = (acc[m.category || "other"] || 0) + 1;
      return acc;
    }, {})
  ).map(([cat, count]) => ({ name: cat, count }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">{t("insights_title", lang)}</h1>
      <p className="text-muted-foreground mb-8">{t("insights_subtitle", lang)}</p>

      {completedSessions.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{t("insights_empty", lang)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cross-session themes */}
          <Card className="p-6">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Layers3 className="w-4 h-4 text-primary" />
              {lang === "es" ? "Mis temas" : "Мои темы"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "es"
                ? "Patrones que se repiten en varias sesiones. Son observaciones provisionales, no diagnósticos ni conclusiones sobre ti."
                : "Темы, которые повторяются в нескольких сессиях. Это предварительные наблюдения, а не диагнозы или выводы о тебе."}
            </p>
            {completedSessions.length < 3 ? (
              <p className="text-sm text-muted-foreground">
                {lang === "es" ? "Completa al menos 3 sesiones para empezar a ver patrones transversales." : "Заверши минимум 3 сессии, чтобы появились поперечные паттерны."}
              </p>
            ) : patternsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === "es" ? "Buscando temas que se repiten…" : "Ищу повторяющиеся темы…"}
              </div>
            ) : themePatterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lang === "es" ? "Aún no hay suficiente evidencia para señalar un tema repetido." : "Пока недостаточно данных, чтобы уверенно выделить повторяющуюся тему."}
              </p>
            ) : (
              <div className="space-y-4">
                {themePatterns.map((pattern, index) => (
                  <div key={`${pattern.label}-${index}`} className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-sm">{pattern.label}</p>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {pattern.session_ids.length} {lang === "es" ? "sesiones" : "сессии"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pattern.observation}</p>
                    {pattern.modes?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {pattern.modes.map((mode) => (
                          <Badge key={mode} variant="outline" className="text-xs">
                            {MODE_NAME_KEYS[mode] ? t(MODE_NAME_KEYS[mode], lang) : mode}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {canUsePractice === true && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={() => generatePracticeForPattern(pattern)}
                        disabled={generatingPattern === `${pattern.label}:${pattern.session_ids.join(",")}`}
                      >
                        {generatingPattern === `${pattern.label}:${pattern.session_ids.join(",")}` ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        {lang === "es" ? "Crear práctica con este tema" : "Создать практику по этой теме"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {practiceError && <p className="mt-4 text-sm text-red-700">{practiceError}</p>}
            {generatedPractice && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">
                  {lang === "es" ? "Práctica creada" : "Практика создана"}
                </p>
                <p className="font-medium text-sm">{generatedPractice.theme_label}</p>
                {generatedPractice.offer_text && (
                  <p className="text-sm text-muted-foreground mt-1">{generatedPractice.offer_text}</p>
                )}
                {generatedPractice.full_text && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      {lang === "es" ? "Leer la práctica" : "Прочитать практику"}
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap leading-relaxed">{generatedPractice.full_text}</div>
                  </details>
                )}
              </div>
            )}
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-1">{t("stat_total_sessions", lang)}</p>
              <p className="text-3xl font-serif font-bold">{completedSessions.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-1">{t("stat_themes_found", lang)}</p>
              <p className="text-3xl font-serif font-bold">{new Set(allThemes).size}</p>
            </Card>
          </div>

          {/* Mode distribution */}
          {modeDistribution.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t("modes_distribution", lang)}
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {modeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {modeDistribution.map((m) => (
                  <div key={m.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.name} ({m.value})
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Themes */}
          {themeFrequency.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-sm mb-4">{t("themes_recurring", lang)}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={themeFrequency} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(160, 30%, 42%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Key memories */}
          {memories.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-sm mb-4">{t("key_observations", lang)}</h3>
              <div className="space-y-3">
                {memories.slice(0, 10).map((mem) => (
                  <div key={mem.id} className="flex items-start gap-3 text-sm">
                    <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">
                      {mem.category || "insight"}
                    </Badge>
                    <div>
                      <p className="font-medium">{mem.key}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{mem.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}