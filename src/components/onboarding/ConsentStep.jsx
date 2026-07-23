import React from "react";
import { Check, Bot, CalendarDays, ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n";
import { birthYearOptions, isOldEnough } from "@/lib/ageGate";

function ConsentCheckbox({ checked, onToggle, label }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-start gap-3 w-full text-left p-4 rounded-xl border border-border hover:bg-accent/40 transition-colors"
    >
      <span
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-border"
        }`}
      >
        {checked && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
      </span>
      <span className="text-sm leading-relaxed">{label}</span>
    </button>
  );
}

export default function ConsentStep({
  lang,
  check1,
  check2,
  check3,
  onToggle1,
  onToggle2,
  onToggle3,
  birthYear,
  onBirthYearChange,
}) {
  const yearChosen = Boolean(birthYear);
  const tooYoung = yearChosen && !isOldEnough(birthYear);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold mb-3">{t("onb_step4_title", lang)}</h2>
        <p className="text-muted-foreground leading-relaxed">{t("onb_step4_text", lang)}</p>
      </div>

      {/* Age gate. Spain's LOPDGDD sets the data-consent threshold at 14, but a
          mental-wellbeing product carries duties toward minors that this app is
          not built to meet, so the product minimum is MIN_AGE. Only the year is
          collected — the minimum needed to apply the rule. */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold">{t("age_title", lang)}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t("age_hint", lang)}</p>
        <label className="block text-sm font-medium mb-1.5" htmlFor="birth-year">
          {t("age_question", lang)}
        </label>
        <select
          id="birth-year"
          value={birthYear || ""}
          onChange={(e) => onBirthYearChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
        >
          <option value="">{t("age_select", lang)}</option>
          {birthYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {tooYoung && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm font-semibold">{t("age_too_young_title", lang)}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("age_too_young_text", lang)}
          </p>
        </div>
      )}

      {/* Consent is only meaningful once the person is old enough to give it,
          so the checkboxes stay hidden until the age question is answered. */}
      {yearChosen && !tooYoung && (
        <>
      {/* EU AI Act Art. 50(1): the user must be informed, before interacting,
          that the counterpart is an AI system. Shown as prominent text, not
          buried in the checkbox label alone. */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">{t("ai_disclosure_title", lang)}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{t("ai_disclosure_text", lang)}</p>
      </div>

          <div className="space-y-3">
            <ConsentCheckbox checked={check1} onToggle={onToggle1} label={t("onb_step4_check1", lang)} />
            <ConsentCheckbox checked={check2} onToggle={onToggle2} label={t("onb_step4_check2", lang)} />
            <ConsentCheckbox checked={check3} onToggle={onToggle3} label={t("onb_step4_check3", lang)} />
          </div>
        </>
      )}
    </div>
  );
}