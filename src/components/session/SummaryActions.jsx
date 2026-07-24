import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, BookmarkPlus, Check } from "lucide-react";
import { generateSessionSummary } from "@/lib/sessionAI";
import { listMessages } from "@/lib/messageApi";
import { t } from "@/lib/i18n";
import { isSummaryUnavailable } from "@/lib/summaryFallback";
import useEntitlement from "@/hooks/useEntitlement";
import { FEATURES } from "@/lib/entitlement";

export default function SummaryActions({ session, onUpdated, language = "ru" }) {
  const { can } = useEntitlement();
  const [generating, setGenerating] = useState(false);
  const [savedToDiary, setSavedToDiary] = useState(false);
  const retryTimer = useRef(null);

  // Generating a summary costs an LLM call, so it is subscription-only.
  const needsSummary = can(FEATURES.SUMMARY) && isSummaryUnavailable(session?.summary);

  const regenerate = useCallback(async () => {
    if (generating || !session) return;
    setGenerating(true);
    try {
      const messages = await listMessages(session.id);
      const userMessages = messages.filter((m) => m.role === "user");
      if (userMessages.length === 0) return;

      const data = await generateSessionSummary(session, messages);
      if (!data.summary || data.summary === FALLBACK) {
        // schedule a retry in 30s
        retryTimer.current = setTimeout(regenerate, 30000);
        return;
      }
      await base44.entities.Session.update(session.id, {
        summary: data.summary,
        themes: data.themes || [],
        signals: data.signals || [],
        next_step_suggestion: data.next_step_suggestion || "",
      });
      onUpdated?.();
    } catch (e) {
      console.error("[SummaryActions] regenerate failed:", e?.message);
      retryTimer.current = setTimeout(regenerate, 30000);
    } finally {
      setGenerating(false);
    }
  }, [generating, session, onUpdated]);

  // Auto-retry once on mount if summary is missing/fallback
  useEffect(() => {
    if (needsSummary && !generating) {
      regenerate();
    }
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const saveToDiary = async () => {
    if (!session?.summary || savedToDiary) return;
    await base44.entities.Insight.create({
      user_id: session.user_id,
      session_id: session.id,
      source_mode: session.mode_id || session.mode,
      title: t("summary_title", language),
      insight_text: session.summary,
      tags: (session.themes || []).join(", "),
      created_at: new Date().toISOString(),
    });
    setSavedToDiary(true);
  };

  if (needsSummary) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {generating ? t("summary_generating", language) : t("summary_absent", language)}
        </p>
        <Button size="sm" onClick={regenerate} disabled={generating} className="gap-1.5 shrink-0">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {t("summary_generate", language)}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex justify-center">
      <Button variant="outline" onClick={saveToDiary} disabled={savedToDiary} className="gap-2 rounded-xl">
        {savedToDiary ? <Check className="w-4 h-4 text-green-600" /> : <BookmarkPlus className="w-4 h-4" />}
        {savedToDiary ? t("saved_to_diary", language) : t("save_to_diary", language)}
      </Button>
    </div>
  );
}