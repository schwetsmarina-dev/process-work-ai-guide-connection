import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Infinity as InfinityIcon, CreditCard, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { t } from "@/lib/i18n";
import useEntitlement from "@/hooks/useEntitlement";

/**
 * Subscription card in Settings.
 *
 * Three states, deliberately distinct:
 *
 *   granted (beta) — founding testers and invited therapists. They see a thank
 *     you and NO upgrade button. Showing a paywall to someone who was promised
 *     the product for free is the fastest way to lose them.
 *   paid           — link to the Stripe portal to change card or cancel.
 *   free           — the only state with a payment button.
 *
 * While the entitlement is loading, `hasAccess` is undefined and nothing is
 * rendered, so a paying user never sees a paywall flash on a slow connection.
 */
export default function SubscriptionCard({ lang }) {
  const { isLoading, hasAccess, plan, isLifetime, expiresAt } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openCheckout = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("createCheckoutSession", {});
      const data = res?.data ?? res;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.alreadyHasAccess) {
        window.location.reload();
        return;
      }
      setError(t("billing_error", lang));
    } catch (e) {
      console.error("[checkout] failed:", e?.message);
      setError(t("billing_error", lang));
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("createPortalSession", {});
      const data = res?.data ?? res;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(t("billing_error", lang));
    } catch (e) {
      console.error("[portal] failed:", e?.message);
      setError(t("billing_error", lang));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return null;

  const isGranted = plan === "beta";

  return (
    <Card className="p-5 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">{t("billing_title", lang)}</h3>
      </div>

      {isGranted && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <InfinityIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium">{t("billing_beta_title", lang)}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("billing_beta_text", lang)}
          </p>
        </div>
      )}

      {!isGranted && hasAccess && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isLifetime
              ? t("billing_paid_lifetime", lang)
              : `${t("billing_paid_until", lang)} ${
                  expiresAt ? new Date(expiresAt).toLocaleDateString() : ""
                }`}
          </p>
          <Button variant="outline" onClick={openPortal} disabled={busy} className="rounded-xl gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {t("billing_manage", lang)}
          </Button>
        </div>
      )}

      {!hasAccess && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("billing_free_text", lang)}
          </p>
          <Button onClick={openCheckout} disabled={busy} className="rounded-xl gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t("billing_subscribe", lang)}
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 mt-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </Card>
  );
}
