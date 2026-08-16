import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { openPaddleCheckout, PADDLE_PRICE_ID } from "@/lib/paddle";

/**
 * Shown in place of a feature the free trial does not include, and when the
 * one free session in a mode has been used.
 *
 * Deliberately not a modal and not a dark pattern: it explains what the trial
 * covers, does not interrupt a session in progress, and is dismissible where
 * it appears inline. Someone in the middle of writing about their inner life
 * should never have a payment screen thrown over the top of it.
 */
export default function UpgradePrompt({ lang, variant = "feature", onDismiss = null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const openCheckout = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Paddle overlay checkout for the Founder plan (€9.99/month).
      // Access is granted by the paddle-webhook writing the Entitlement, not
      // by the browser — so on completion we just reload and re-read it.
      await openPaddleCheckout(PADDLE_PRICE_ID, {
        onComplete: () => window.location.reload(),
      });
    } catch (e) {
      // Surface the real reason on screen. A silent failure here is impossible
      // to diagnose for a non-technical owner; the message (e.g. a missing
      // client token, or a Paddle configuration error) is what we need to see.
      const msg = e?.message || String(e);
      console.error("[upgrade] checkout failed:", msg);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const titleKey = variant === "quota" ? "upgrade_quota_title" : "upgrade_feature_title";
  const textKey = variant === "quota" ? "upgrade_quota_text" : "upgrade_feature_text";

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <h3 className="font-semibold text-sm">{t(titleKey, lang)}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{t(textKey, lang)}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openCheckout} disabled={busy} className="rounded-xl gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t("billing_subscribe", lang)}
        </Button>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss} className="rounded-xl">
            {t("cancel", lang)}
          </Button>
        )}
      </div>

      {err && (
        <div className="flex items-start gap-2 mt-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{err}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        <a href="https://talvira.es/terminos-y-condiciones/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {t("legal_terms", lang)}
        </a>
      </p>
    </div>
  );
}
