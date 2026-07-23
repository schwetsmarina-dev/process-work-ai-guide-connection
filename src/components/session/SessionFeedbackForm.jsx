import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, CheckCircle2, Loader2, Send } from "lucide-react";
import { normalizeLang, t } from "@/lib/i18n";

export default function SessionFeedbackForm({ session, user, language }) {
  const lang = normalizeLang(language || "ru");
  const [checking, setChecking] = useState(true);
  const [alreadySent, setAlreadySent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rating, setRating] = useState(0);
  const [useful, setUseful] = useState("");
  const [confusing, setConfusing] = useState("");
  const [wouldUseAgain, setWouldUseAgain] = useState(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    (async () => {
      const existing = await base44.entities.SessionFeedback.filter({
        session_id: session.id,
        user_email: user.email,
      });
      if (existing.length > 0) setAlreadySent(true);
      setChecking(false);
    })();
  }, [session.id, user.email]);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    await base44.entities.SessionFeedback.create({
      session_id: session.id,
      user_id: user.id,
      user_email: user.email,
      mode_id: session.mode_id || session.mode,
      language: lang,
      rating: rating || undefined,
      useful,
      confusing,
      would_use_again: wouldUseAgain,
      comment,
      created_at: new Date().toISOString(),
    });
    // Ratings and flags only — the free-text comment is never transmitted.
    track(EVENTS.FEEDBACK_SUBMITTED, {
      mode: session.mode_id || session.mode || "unknown",
      language: lang,
      rating: rating || 0,
      useful: Boolean(useful),
      confusing: Boolean(confusing),
      would_use_again: Boolean(wouldUseAgain),
      has_comment: Boolean(comment && comment.trim()),
    });
    console.log("[SESSION_FEEDBACK_SAVED]", {
      session_id: session.id,
      user_email: user.email,
      rating,
      would_use_again: wouldUseAgain,
    });
    setSubmitted(true);
    setSaving(false);
  };

  if (checking) return null;

  if (alreadySent || submitted) {
    return (
      <Card className="p-6 mt-6 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="w-4 h-4" />
          {submitted ? t("feedback_success", lang) : t("feedback_already", lang)}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{t("feedback_title", lang)}</h3>
      </div>

      <div className="space-y-5">
        {/* Rating */}
        <div>
          <label className="text-sm font-medium block mb-2">{t("feedback_rating", lang)}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Useful */}
        <div>
          <label className="text-sm font-medium block mb-2">{t("feedback_useful", lang)}</label>
          <Textarea value={useful} onChange={(e) => setUseful(e.target.value)} rows={2} />
        </div>

        {/* Confusing */}
        <div>
          <label className="text-sm font-medium block mb-2">{t("feedback_confusing", lang)}</label>
          <Textarea value={confusing} onChange={(e) => setConfusing(e.target.value)} rows={2} />
        </div>

        {/* Would use again */}
        <div>
          <label className="text-sm font-medium block mb-2">{t("feedback_would_use_again", lang)}</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={wouldUseAgain === true ? "default" : "outline"}
              size="sm"
              onClick={() => setWouldUseAgain(true)}
            >
              {t("feedback_yes", lang)}
            </Button>
            <Button
              type="button"
              variant={wouldUseAgain === false ? "default" : "outline"}
              size="sm"
              onClick={() => setWouldUseAgain(false)}
            >
              {t("feedback_no", lang)}
            </Button>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-medium block mb-2">{t("feedback_comment", lang)}</label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </div>

        <Button onClick={handleSubmit} disabled={saving} className="w-full rounded-xl">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t("feedback_submit", lang)}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}