import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Check, Loader2 } from "lucide-react";
import { saveInsight } from "@/lib/insightAI";
import { t } from "@/lib/i18n";

const IMPORTANCE_KEYS = { 1: "importance_1", 2: "importance_2", 3: "importance_3" };

export default function SessionInsightSuggestions({ suggestions, session, lang = "ru" }) {
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingIdx, setSavingIdx] = useState(null);

  if (!suggestions || suggestions.length === 0) return null;

  const handleSave = async (insight, idx) => {
    setSavingIdx(idx);
    await saveInsight({
      sessionId: session.id,
      sourceMode: session.mode_id || session.mode,
      insight,
    });
    setSavedIds((prev) => new Set([...prev, idx]));
    setSavingIdx(null);
  };

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{t("insights_possible", lang)}</h3>
        <span className="text-xs text-muted-foreground">{t("insights_save_hint", lang)}</span>
      </div>

      <div className="space-y-4">
        {suggestions.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-accent/40 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">{insight.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{insight.insight_text}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {insight.importance && (
                  <Badge variant="secondary" className="text-xs">
                    {t(IMPORTANCE_KEYS[insight.importance] || "importance_2", lang)}
                  </Badge>
                )}
                {insight.tags && insight.tags.split(",").slice(0, 2).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{tag.trim()}</Badge>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant={savedIds.has(idx) ? "secondary" : "outline"}
              className="shrink-0"
              disabled={savedIds.has(idx) || savingIdx === idx}
              onClick={() => handleSave(insight, idx)}
            >
              {savingIdx === idx ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : savedIds.has(idx) ? (
                <><Check className="w-3.5 h-3.5 mr-1" /> {t("saved", lang)}</>
              ) : (
                t("save", lang)
              )}
            </Button>
          </div>
        ))}
      </div>

      {savedIds.size > 0 && (
        <p className="text-xs text-primary mt-3 flex items-center gap-1">
          <Check className="w-3 h-3" />
          {t("insights_saved_to_library", lang)}
        </p>
      )}
    </Card>
  );
}