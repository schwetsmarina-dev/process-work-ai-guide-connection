import React from "react";
import { Sparkles } from "lucide-react";
import { MODE_LABELS } from "@/lib/modeSteps";

export default function ModeCardDB({ mode, onClick, lang = "ru" }) {
  const modeId = mode.mode_id || mode.id;
  const label = MODE_LABELS[modeId]?.[lang] || mode.mode_name_ru || modeId;
  const description = lang === "es"
    ? (mode.description_es || mode.description)
    : mode.description;

  return (
    <button
      onClick={() => onClick(mode)}
      className="group text-left p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 w-full"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-serif text-lg font-semibold mb-1">
        {label}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description || ""}
      </p>
    </button>
  );
}
