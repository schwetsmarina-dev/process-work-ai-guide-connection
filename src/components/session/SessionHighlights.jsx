import React from "react";
import { Card } from "@/components/ui/card";
import { Tag, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { t } from "@/lib/i18n";

// Compact, scannable overview of the key themes and signals the AI found.
// Shown at the top of the session report so they're easy to glance at.
export default function SessionHighlights({ themes = [], signals = [], language = "ru" }) {
  const hasThemes = themes.length > 0;
  const hasSignals = signals.length > 0;
  if (!hasThemes && !hasSignals) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
    >
      <Card className="p-6 grid gap-6 sm:grid-cols-2">
        {hasThemes && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{t("themes", language)}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasSignals && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-chart-3/15 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-chart-3" />
              </div>
              <h3 className="font-semibold text-sm">{t("noticed_signals", language)}</h3>
            </div>
            <ul className="space-y-1.5">
              {signals.map((signal, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-chart-3 mt-2 shrink-0" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </motion.div>
  );
}