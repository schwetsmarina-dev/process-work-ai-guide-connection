import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Languages, Check } from "lucide-react";
import { normalizeLang, t } from "@/lib/i18n";

const OPTIONS = [
  { value: "ru", labelKey: "language_russian" },
  { value: "es", labelKey: "language_spanish" },
];

export default function LanguageSelector({ lang, onChange }) {
  const [saving, setSaving] = useState(false);
  const current = normalizeLang(lang);

  const handleSelect = async (value) => {
    if (value === current || saving) return;
    setSaving(true);
    await base44.auth.updateMe({ language: value });
    onChange?.(value);
    setSaving(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Languages className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{t("language", current)}</h3>
      </div>
      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={saving}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-accent text-foreground"
              }`}
            >
              <span>{t(opt.labelKey, current)}</span>
              {active && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}