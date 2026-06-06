import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModeIcon, getModeLabel } from "./modeVisual";
import { t } from "@/lib/i18n";

export default function JournalSessionCard({ session, lang, onRepeat }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getModeIcon(session.mode_id || session.mode);
  const label = getModeLabel(session.mode_id || session.mode, lang);
  const summary = session.summary || "";
  const preview = summary.length > 100 ? summary.slice(0, 100) + "…" : summary;
  const themes = Array.isArray(session.themes) ? session.themes : [];

  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(session.created_date), "d MMM yyyy, HH:mm")}
            </span>
          </div>

          {summary && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {expanded ? summary : preview}
            </p>
          )}

          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {themes.map((theme, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {summary && summary.length > 100 && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? t("journal_collapse", lang) : t("journal_read_full", lang)}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => onRepeat(session.mode_id || session.mode)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("journal_repeat_session", lang)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}