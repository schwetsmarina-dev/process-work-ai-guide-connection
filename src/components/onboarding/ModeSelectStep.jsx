import React from "react";
import { Loader2 } from "lucide-react";

export default function ModeSelectStep({ modes, loading, selectedId, onSelect, lang }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modes.map((mode) => {
        const name = lang === "es" ? (mode.mode_name_es || mode.mode_name_en || mode.mode_name_ru) : mode.mode_name_ru;
        const isSelected = selectedId === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onSelect(mode)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <p className="font-serif text-lg font-semibold mb-1">{name}</p>
            {mode.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{mode.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}