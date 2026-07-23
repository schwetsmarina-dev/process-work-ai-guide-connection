import React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t, getStoredLanguage } from "@/lib/i18n";
import { getModeIcon, getModeLabel } from "@/components/journal/modeVisual";

const IMPORTANCE_KEYS = { 1: "importance_1", 2: "importance_2", 3: "importance_3_full" };

export default function TimelineEvent({ event, side, onClick }) {
  const isSession = event.kind === "session";
  const ModeIcon = isSession ? getModeIcon(event.mode) : Lightbulb;

  return (
    <div className={`relative flex ${side === "left" ? "md:flex-row-reverse" : "md:flex-row"} items-start gap-4`}>
      {/* Dot on the central line */}
      <div className="absolute left-4 md:left-1/2 -translate-x-1/2 top-3 z-10">
        <div
          className={`w-4 h-4 rounded-full border-2 border-background ring-2 ${
            isSession ? "bg-primary ring-primary/30" : "bg-chart-3 ring-chart-3/30"
          }`}
        />
      </div>

      {/* Card */}
      <div className={`w-full md:w-1/2 pl-12 md:pl-0 ${side === "left" ? "md:pr-10" : "md:pl-10"}`}>
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClick}
          className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isSession ? "bg-primary/10 text-primary" : "bg-chart-3/15 text-chart-3"
            }`}>
              <ModeIcon className="w-4 h-4" />
            </div>
            <span className="text-xs text-muted-foreground">
              {event.date ? format(new Date(event.date), "d MMM yyyy, HH:mm") : "—"}
            </span>
          </div>

          {isSession ? (
            <>
              <p className="text-sm font-medium">{getModeLabel(event.mode)}</p>
              {event.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{event.summary}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium leading-snug">{event.title}</p>
              {event.importance && (
                <Badge variant="secondary" className="text-xs mt-2">
                  {t(IMPORTANCE_KEYS[event.importance] || "importance_2", getStoredLanguage())}
                </Badge>
              )}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}