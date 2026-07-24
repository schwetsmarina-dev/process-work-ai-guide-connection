import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { t } from "@/lib/i18n";

/**
 * Shown in place of a feature the free trial does not include, and when the
 * one free session in a mode has been used.
 *
 * Deliberately not a modal and not a dark pattern: it explains what the trial
 * covers, does not interrupt a session in progress, and is dismissible where
 * it appears inline. Someone in the middle of writing about their inner life
 * should never have a payment screen thrown over the top of it.
 */
export default function UpgradePrompt({ lang, variant = "feature", onDismiss }) {
  const [busy, setBusy] = useState(false);

  const openCheckout = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createCheckoutSession", {});
      const data = res?.data ?? res;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.alreadyHasAccess) window.location.reload();
    } catch (e) {
      console.error("[upgrade] checkout failed:", e?.message);
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

      <p className="text-xs text-muted-foreground mt-3">
        <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {t("legal_terms", lang)}
        </Link>
      </p>
    </div>
  );
}
