import React from "react";
import { Sparkles } from "lucide-react";
import { MODE_LABELS } from "@/lib/modeSteps";

export default function ModeCardDB({ mode, onClick, lang = "es" }) {
  const modeId = mode.mode_id || mode.id;
  const spanishFallbacks = {
    body: "Exploración de sensaciones corporales, tensión, dolor y otras señales del cuerpo.",
    dream: "Exploración de imágenes, símbolos, atmósferas y figuras que aparecen en tus sueños.",
    conflict: "Exploración de posiciones, deseos o partes de ti que tiran en direcciones distintas.",
    journaling: "Exploración guiada y suave de lo que estás viviendo, sintiendo o pensando ahora.",
  };
  const label = lang === "es"
    ? (mode.mode_name_es || MODE_LABELS[modeId]?.es || modeId)
    : (mode.mode_name_ru || MODE_LABELS[modeId]?.ru || modeId);
  const description = lang === "es"
    ? (mode.description_es || spanishFallbacks[modeId] || "")
    : (mode.description || "");

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
