import React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModeIcon } from "./modeVisual";
import { t } from "@/lib/i18n";

export default function JournalInsightCard({ insight, lang, onToggleFavorite, isUpdating }) {
  const Icon = getModeIcon(insight.source_mode);
  const fav = !!insight.is_favorite;

  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {insight.title && <h3 className="font-medium text-sm">{insight.title}</h3>}
          {insight.insight_text && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{insight.insight_text}</p>
          )}
          <div className="mt-3">
            <Button
              variant={fav ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              disabled={isUpdating}
              onClick={() => onToggleFavorite(insight)}
            >
              <Heart className={`w-3.5 h-3.5 ${fav ? "fill-current text-rose-500" : ""}`} />
              {fav ? t("journal_favorited", lang) : t("journal_add_favorite", lang)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}