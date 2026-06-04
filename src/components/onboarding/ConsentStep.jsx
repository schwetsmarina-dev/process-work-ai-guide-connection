import React from "react";
import { Check } from "lucide-react";
import { t } from "@/lib/i18n";

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

export default function ConsentStep({ lang, check1, check2, onToggle1, onToggle2 }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold mb-3">{t("onb_step4_title", lang)}</h2>
        <p className="text-muted-foreground leading-relaxed">{t("onb_step4_text", lang)}</p>
      </div>

      <div className="space-y-3">
        <ConsentCheckbox checked={check1} onToggle={onToggle1} label={t("onb_step4_check1", lang)} />
        <ConsentCheckbox checked={check2} onToggle={onToggle2} label={t("onb_step4_check2", lang)} />
      </div>
    </div>
  );
}