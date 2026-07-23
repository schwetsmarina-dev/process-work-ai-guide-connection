import { t, getStoredLanguage } from "@/lib/i18n";
import { isSummaryUnavailable } from "@/lib/summaryFallback";
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { generateSessionSummary } from "@/lib/sessionAI";
import { listMessages } from "@/lib/messageApi";


export function needsRegenerate(session) {
  return !session?.summary || isSummaryUnavailable(session.summary);
}

export default function RegenerateSummaryButton({ session, onUpdated }) {
  const [generating, setGenerating] = useState(false);

  const regenerate = async (e) => {
    e?.stopPropagation();
    if (generating) return;
    setGenerating(true);
    try {
      const messages = await listMessages(session.id);
      if (messages.filter((m) => m.role === "user").length === 0) return;

      const data = await generateSessionSummary(session, messages);
      if (!data.summary || data.summary === FALLBACK) return;

      await base44.entities.Session.update(session.id, {
        summary: data.summary,
        themes: data.themes || [],
        signals: data.signals || [],
        next_step_suggestion: data.next_step_suggestion || "",
      });
      onUpdated?.();
    } catch (err) {
      console.error("[RegenerateSummaryButton] failed:", err?.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={regenerate} disabled={generating} className="gap-1.5">
      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {t("summary_generate", getStoredLanguage())}
    </Button>
  );
}