import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Flame,
  CalendarDays,
  Sparkles,
  TrendingUp,
  Heart,
  Moon,
  GitBranch,
  PenLine,
  ArrowRight,
} from "lucide-react";
import { startOfWeek, subWeeks, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { normalizeLang } from "@/lib/i18n";
import { MODE_LABELS } from "@/lib/modeSteps";

const MODE_ICON_COMP = { body: Heart, dream: Moon, conflict: GitBranch, journaling: PenLine };
const MODE_ORDER = ["body", "dream", "conflict", "journaling"];

// Bilingual copy kept local so this page is self-contained.
const L = {
  ru: {
    title: "Прогресс",
    subtitle: "Твой путь самоисследования во времени",
    empty: "Пока нет завершённых сессий. Начни первую — и здесь появится твоя картина прогресса.",
    start: "Начать сессию",
    stat_total: "Всего сессий",
    stat_streak: "Серия",
    stat_streak_unit: "нед. подряд",
    stat_week: "На этой неделе",
    stat_insights: "Инсайтов",
    recap_title: "На этой неделе",
    recap_none: "На этой неделе сессий пока нет. Даже одна короткая сессия поддержит ритм.",
    recap_sessions: "сессий",
    recap_modes: "Режимы недели",
    recap_themes: "Темы недели",
    modes_title: "Что ты исследуешь",
    modes_hint: "Баланс режимов помогает увидеть, куда тянется внимание — и что стоит попробовать.",
    themes_title: "Повторяющиеся темы",
    themes_hint: "То, что возвращается из сессии в сессию, — это и есть твой процесс.",
    themes_none: "Темы появятся, когда накопится несколько сессий.",
    deeper: "Глубже",
    map: "Карта процесса",
    timeline: "Timeline личности",
    analytics: "Аналитика",
    times: "раз",
  },
  es: {
    title: "Progreso",
    subtitle: "Tu camino de autoconocimiento a lo largo del tiempo",
    empty: "Aún no hay sesiones completadas. Empieza la primera y aquí aparecerá tu progreso.",
    start: "Empezar sesión",
    stat_total: "Sesiones totales",
    stat_streak: "Racha",
    stat_streak_unit: "sem. seguidas",
    stat_week: "Esta semana",
    stat_insights: "Insights",
    recap_title: "Esta semana",
    recap_none: "Aún no hay sesiones esta semana. Incluso una sesión corta mantiene el ritmo.",
    recap_sessions: "sesiones",
    recap_modes: "Modos de la semana",
    recap_themes: "Temas de la semana",
    modes_title: "Qué exploras",
    modes_hint: "El equilibrio entre modos muestra hacia dónde va tu atención y qué probar.",
    themes_title: "Temas recurrentes",
    themes_hint: "Lo que vuelve sesión tras sesión es tu proceso.",
    themes_none: "Los temas aparecerán cuando tengas varias sesiones.",
    deeper: "Más a fondo",
    map: "Mapa del proceso",
    timeline: "Timeline personal",
    analytics: "Analítica",
    times: "veces",
  },
};

function sessionDate(s) {
  return new Date(s.ended_at || s.updated_date || s.created_date || s.started_at);
}

function StatCard({ icon: Icon, value, label, sub, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
      <Icon className={`w-5 h-5 ${accent || "text-primary"}`} />
      <div className="text-2xl font-semibold leading-none mt-1">{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">
        {label}
        {sub ? <span className="block">{sub}</span> : null}
      </div>
    </div>
  );
}

function Bar({ label, count, max, Icon }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-40 shrink-0">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-muted-foreground w-6 text-right tabular-nums">{count}</span>
    </div>
  );
}

export default function Progress() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const lang = normalizeLang(appUser?.language || "ru");
  const tx = L[lang] || L.ru;

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setCurrentUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      setAppUser(rows[0] || null);
    })();
  }, []);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["progress-sessions", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 500),
    enabled: !!currentUser?.email,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["progress-insights", currentUser?.email],
    queryFn: () => base44.entities.Insight.filter({ created_by: currentUser.email }, "-created_date", 500),
    enabled: !!currentUser?.email,
  });

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "completed");
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Weeks that contain at least one completed session
    const weekKeys = new Set(
      completed
        .map((s) => sessionDate(s))
        .filter((d) => !isNaN(d.getTime()))
        .map((d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"))
    );
    let streak = 0;
    let cursor = weekStart;
    if (!weekKeys.has(format(cursor, "yyyy-MM-dd"))) cursor = subWeeks(cursor, 1);
    while (weekKeys.has(format(cursor, "yyyy-MM-dd"))) {
      streak += 1;
      cursor = subWeeks(cursor, 1);
    }

    const thisWeek = completed.filter((s) => sessionDate(s) >= weekStart);
    const thisWeekModes = [...new Set(thisWeek.map((s) => s.mode_id || s.mode).filter(Boolean))];
    const thisWeekThemes = [
      ...new Set(thisWeek.flatMap((s) => (Array.isArray(s.themes) ? s.themes : []))),
    ]
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 6);

    const modeCounts = {};
    MODE_ORDER.forEach((m) => (modeCounts[m] = 0));
    completed.forEach((s) => {
      const m = s.mode_id || s.mode;
      if (m in modeCounts) modeCounts[m] += 1;
    });

    const themeCounts = {};
    completed.forEach((s) =>
      (Array.isArray(s.themes) ? s.themes : []).forEach((t) => {
        const k = String(t).trim();
        if (k) themeCounts[k] = (themeCounts[k] || 0) + 1;
      })
    );
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      total: completed.length,
      streak,
      thisWeekCount: thisWeek.length,
      thisWeekModes,
      thisWeekThemes,
      modeCounts,
      topThemes,
    };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxMode = Math.max(1, ...Object.values(stats.modeCounts));
  const maxTheme = Math.max(1, ...stats.topThemes.map(([, c]) => c));

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-primary" />
          {tx.title}
        </h1>
        <p className="text-muted-foreground">{tx.subtitle}</p>
      </div>

      {stats.total === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-5">{tx.empty}</p>
          <Button onClick={() => navigate("/dashboard")}>{tx.start}</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={CalendarDays} value={stats.total} label={tx.stat_total} />
            <StatCard
              icon={Flame}
              value={stats.streak}
              label={tx.stat_streak}
              sub={tx.stat_streak_unit}
              accent="text-orange-500"
            />
            <StatCard icon={TrendingUp} value={stats.thisWeekCount} label={tx.stat_week} />
            <StatCard icon={Sparkles} value={insights.length} label={tx.stat_insights} accent="text-amber-500" />
          </div>

          {/* Weekly recap */}
          <div className="rounded-2xl border-2 border-primary/15 bg-primary/5 p-5">
            <h2 className="font-serif text-lg font-semibold mb-2">{tx.recap_title}</h2>
            {stats.thisWeekCount === 0 ? (
              <p className="text-sm text-muted-foreground">{tx.recap_none}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-2xl font-semibold text-primary mr-1">{stats.thisWeekCount}</span>
                  {tx.recap_sessions}
                </p>
                {stats.thisWeekModes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx.recap_modes}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.thisWeekModes.map((m) => (
                        <span key={m} className="px-2.5 py-1 rounded-full bg-card border border-border text-xs">
                          {MODE_LABELS[m]?.[lang] || MODE_LABELS[m]?.ru || m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {stats.thisWeekThemes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx.recap_themes}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.thisWeekThemes.map((th) => (
                        <span key={th} className="px-2.5 py-1 rounded-full bg-card border border-border text-xs">
                          {th}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modes explored */}
          <div>
            <h2 className="font-serif text-lg font-semibold mb-1">{tx.modes_title}</h2>
            <p className="text-xs text-muted-foreground mb-4">{tx.modes_hint}</p>
            <div className="space-y-3">
              {MODE_ORDER.map((m) => (
                <Bar
                  key={m}
                  label={MODE_LABELS[m]?.[lang] || MODE_LABELS[m]?.ru || m}
                  count={stats.modeCounts[m] || 0}
                  max={maxMode}
                  Icon={MODE_ICON_COMP[m]}
                />
              ))}
            </div>
          </div>

          {/* Recurring themes */}
          <div>
            <h2 className="font-serif text-lg font-semibold mb-1">{tx.themes_title}</h2>
            <p className="text-xs text-muted-foreground mb-4">{tx.themes_hint}</p>
            {stats.topThemes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tx.themes_none}</p>
            ) : (
              <div className="space-y-3">
                {stats.topThemes.map(([theme, count]) => (
                  <Bar key={theme} label={theme} count={count} max={maxTheme} />
                ))}
              </div>
            )}
          </div>

          {/* Deeper links */}
          <div>
            <h2 className="font-serif text-lg font-semibold mb-3">{tx.deeper}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { path: "/life-process-map", label: tx.map },
                { path: "/timeline", label: tx.timeline },
                { path: "/insights", label: tx.analytics },
              ].map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="rounded-2xl border border-border bg-card p-4 text-left text-sm flex items-center justify-between hover:bg-accent/40 transition-colors"
                >
                  {link.label}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
