import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CalendarDays, ShieldAlert, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { birthYearOptions, isOldEnough } from "@/lib/ageGate";

/**
 * Age check for accounts that predate the age gate.
 *
 * The gate was added to onboarding, which only covers people registering from
 * that point on. Everyone who signed up earlier has no birth_year at all, so
 * their age is simply unknown — and "unknown" is not a defensible answer for a
 * service that must not be used by under-16s.
 *
 * This asks once, blocks the app until answered, and then never appears again.
 */
export default function AgeVerificationGate({ appUser, lang, onVerified }) {
  const [birthYear, setBirthYear] = useState(null);
  const [saving, setSaving] = useState(false);

  const tooYoung = birthYear && !isOldEnough(birthYear);

  const save = async () => {
    if (!isOldEnough(birthYear) || !appUser?.id) return;
    setSaving(true);
    try {
      await base44.entities.AppUser.update(appUser.id, {
        birth_year: birthYear,
        age_confirmed_at: new Date().toISOString(),
      });
      onVerified?.();
    } catch (e) {
      console.error("[AgeVerificationGate] save failed:", e?.message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-primary shrink-0" />
            <h1 className="font-serif text-xl font-semibold">{t("age_title", lang)}</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {t("age_hint", lang)}
          </p>

          <label className="block text-sm font-medium mb-1.5" htmlFor="verify-birth-year">
            {t("age_question", lang)}
          </label>
          <select
            id="verify-birth-year"
            value={birthYear || ""}
            onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : null)}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm mb-4"
          >
            <option value="">{t("age_select", lang)}</option>
            {birthYearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {tooYoung && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-sm font-semibold">{t("age_too_young_title", lang)}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("age_too_young_text", lang)}
              </p>
            </div>
          )}

          <Button
            onClick={save}
            disabled={!isOldEnough(birthYear) || saving}
            className="w-full rounded-xl gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("continue", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
