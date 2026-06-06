import React from "react";
import { format } from "date-fns";
import { CheckCircle2, Lightbulb, Star, CalendarPlus, CalendarCheck } from "lucide-react";
import { getModeLabel } from "./modeVisual";
import { t } from "@/lib/i18n";

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

export default function JournalProgress({ sessions, insightsCount, lang }) {
  const completed = sessions.filter((s) => s.status === "completed");
  const dash = t("journal_no_data", lang);

  // Most-used mode
  const counts = {};
  for (const s of completed) {
    const m = s.mode_id || s.mode || "—";
    counts[m] = (counts[m] || 0) + 1;
  }
  const topMode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // First / last session (completed list already sorted desc by created_date)
  const last = completed[0]?.created_date;
  const first = completed[completed.length - 1]?.created_date;

  const fmt = (d) => (d ? format(new Date(d), "d MMM yyyy") : dash);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <StatRow icon={CheckCircle2} label={t("journal_stat_sessions", lang)} value={completed.length} />
      <StatRow icon={Lightbulb} label={t("journal_stat_insights", lang)} value={insightsCount} />
      <StatRow icon={Star} label={t("journal_stat_top_mode", lang)} value={topMode ? getModeLabel(topMode, lang) : dash} />
      <StatRow icon={CalendarPlus} label={t("journal_stat_first_session", lang)} value={fmt(first)} />
      <StatRow icon={CalendarCheck} label={t("journal_stat_last_session", lang)} value={fmt(last)} />
    </div>
  );
}