import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { t, getStoredLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const MODE_COLORS = {
  body: "hsl(160, 30%, 42%)",
  dream: "hsl(200, 25%, 50%)",
  conflict: "hsl(30, 40%, 55%)",
  journaling: "hsl(280, 20%, 55%)",
};

const MODE_NAMES = {
  body: "Тело",
  dream: "Сны",
  conflict: "Конфликт",
  journaling: "Дневник",
};

export default function Insights() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions-all", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 100),
    enabled: !!currentUser?.email,
  });

  const { data: memories = [], isLoading: memoriesLoading } = useQuery({
    queryKey: ["memories", currentUser?.email],
    queryFn: () => base44.entities.UserMemory.filter({ created_by: currentUser.email }, "-created_date", 50),
    enabled: !!currentUser?.email,
  });

  const isLoading = sessionsLoading || memoriesLoading;
  const completedSessions = sessions.filter((s) => s.status === "completed");

  // Mode distribution
  const modeDistribution = Object.entries(
    completedSessions.reduce((acc, s) => {
      acc[s.mode] = (acc[s.mode] || 0) + 1;
      return acc;
    }, {})
  ).map(([mode, count]) => ({
    name: MODE_NAMES[mode] || mode,
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