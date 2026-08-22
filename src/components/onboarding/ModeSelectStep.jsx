import React from "react";
import { Loader2 } from "lucide-react";

const SPANISH_DESCRIPTIONS = {
  body: "Exploración de sensaciones corporales, tensión, dolor y otras señales del cuerpo.",
  dream: "Exploración de imágenes, símbolos, atmósferas y figuras que aparecen en tus sueños.",
  conflict: "Exploración de posiciones, deseos o partes de ti que tiran en direcciones distintas.",
  journaling: "Exploración guiada y suave de lo que estás viviendo, sintiendo o pensando ahora.",
};

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
        const name = lang === "es" ? (mode.mode_name_es || "") : mode.mode_name_ru;
        const description = lang === "es"
          ? (mode.description_es || SPANISH_DESCRIPTIONS[mode.mode_id] || "")
          : (mode.description || "");
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
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}