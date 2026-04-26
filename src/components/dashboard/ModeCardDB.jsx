import React from "react";
import { Sparkles } from "lucide-react";

export default function ModeCardDB({ mode, onClick }) {
  return (
    <button
      onClick={() => onClick(mode)}
      className="group text-left p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 w-full"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-serif text-lg font-semibold mb-1">
        {mode.mode_name_ru || mode.mode_id}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {mode.description || ""}
      </p>
    </button>
  );
}